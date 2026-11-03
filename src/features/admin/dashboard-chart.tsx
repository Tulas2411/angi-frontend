"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { bucketLabel, count, niceScale } from "./dashboard-rules";
import type { DashboardInterval } from "./dashboard-types";

const height = 260;
const pad = { top: 16, right: 16, bottom: 32, left: 44 };

/**
 * One series over time (ADM-D2): a 2px line on a light area, recessive gridlines, a crosshair
 * with a tooltip on hover or arrow keys, and the latest value labelled. One series, so the
 * title names it and there is no legend box.
 */
export function TrendChart({
  points,
  interval,
  label,
}: {
  points: { bucket: string; value: number }[];
  interval: DashboardInterval;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(280, element.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const values = points.map((point) => point.value);
  const scale = niceScale(Math.max(0, ...values));
  const inner = {
    w: width - pad.left - pad.right,
    h: height - pad.top - pad.bottom,
  };
  const x = (index: number) =>
    pad.left +
    (points.length <= 1
      ? inner.w / 2
      : (index / (points.length - 1)) * inner.w);
  const y = (value: number) =>
    pad.top + inner.h - (value / scale.max) * inner.h;
  const line = points
    .map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.value)}`)
    .join(" ");
  const area = points.length
    ? `${line} L${x(points.length - 1)},${pad.top + inner.h} L${x(0)},${pad.top + inner.h} Z`
    : "";
  const ticks = Array.from(
    { length: Math.round(scale.max / scale.step) + 1 },
    (_, index) => index * scale.step,
  );
  // About one x label per 80px, always the first and the last.
  const every = Math.max(
    1,
    Math.ceil(points.length / Math.max(2, inner.w / 80)),
  );
  const last = points.length - 1;

  function pick(clientX: number) {
    const element = box.current;
    if (!element || !points.length) return;
    const left = element.getBoundingClientRect().left;
    const ratio = (clientX - left - pad.left) / Math.max(1, inner.w);
    setActive(Math.max(0, Math.min(last, Math.round(ratio * last))));
  }
  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!points.length) return;
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      Home: -Infinity,
      End: Infinity,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const step = moves[event.key];
    setActive((current) => {
      const from = current ?? (step > 0 ? -1 : points.length);
      return Math.max(0, Math.min(last, from + step));
    });
  }

  const shown = active === null ? null : points[active];
  return (
    <div
      ref={box}
      className="dash-chart"
      tabIndex={0}
      role="img"
      aria-label={`${label}: ${points.length} mốc, mới nhất ${points.length ? count(points[last].value) : 0}. Dùng phím mũi tên để đọc từng mốc.`}
      onPointerMove={(event) => pick(event.clientX)}
      onPointerLeave={() => setActive(null)}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
    >
      <svg width={width} height={height} aria-hidden="true">
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="dash-grid"
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text
              className="dash-axis"
              x={pad.left - 8}
              y={y(tick)}
              dy="0.32em"
              textAnchor="end"
            >
              {count(tick)}
            </text>
          </g>
        ))}
        {points.map((point, index) =>
          index % every === 0 || index === last ? (
            <text
              key={point.bucket}
              className="dash-axis"
              x={x(index)}
              y={height - 10}
              textAnchor={
                index === 0 ? "start" : index === last ? "end" : "middle"
              }
            >
              {bucketLabel(point.bucket, interval)}
            </text>
          ) : null,
        )}
        <path className="dash-area" d={area} />
        <path className="dash-line" d={line} />
        {points.length > 0 && active === null && (
          <g>
            <circle
              className="dash-dot"
              cx={x(last)}
              cy={y(points[last].value)}
              r={4}
            />
            <text
              className="dash-value"
              x={x(last)}
              y={y(points[last].value) - 10}
              textAnchor="end"
            >
              {count(points[last].value)}
            </text>
          </g>
        )}
        {shown && active !== null && (
          <g>
            <line
              className="dash-crosshair"
              x1={x(active)}
              x2={x(active)}
              y1={pad.top}
              y2={pad.top + inner.h}
            />
            <circle
              className="dash-dot"
              cx={x(active)}
              cy={y(shown.value)}
              r={5}
            />
          </g>
        )}
      </svg>
      {shown && active !== null && (
        <div
          className="dash-tooltip"
          style={{
            left: Math.min(Math.max(x(active), 80), width - 80),
            top: Math.max(y(shown.value) - 12, 8),
          }}
        >
          <span>{bucketLabel(shown.bucket, interval, true)}</span>
          <strong>{count(shown.value)}</strong>
        </div>
      )}
    </div>
  );
}

/**
 * A breakdown as horizontal bars (one hue, magnitude only), each with its count and share
 * written beside it, so no colour has to be decoded.
 */
export function BarList({
  rows,
  label,
}: {
  rows: { key: string; label: string; value: number; share: number }[];
  label: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="dash-bars" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key}>
          <span className="dash-bars-label">{row.label}</span>
          <span className="dash-bars-track" aria-hidden>
            <span style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <span className="dash-bars-value">
            {count(row.value)}
            <small>{Math.round(row.share * 100)}%</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
