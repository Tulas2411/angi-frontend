"use client";
import type { CSSProperties } from "react";

/** The track runs from 00:00 to 06:00 the next day, so a closing time can pass midnight. */
export const trackEnd = 30 * 60;
const day = 24 * 60;
const step = 15;

export const toMinutes = (time: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
export const toTime = (minutes: number) => {
  const inDay = ((minutes % day) + day) % day;
  return `${String(Math.floor(inDay / 60)).padStart(2, "0")}:${String(inDay % 60).padStart(2, "0")}`;
};

/**
 * A saved range as track positions: a closing time earlier than (or equal to) the opening time
 * closes the next day, so it is placed after 24:00.
 */
export function rangeOnTrack(openTime: string, closeTime: string) {
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  if (open === null || close === null) return null;
  return { open, close: close <= open ? close + day : close };
}

/** Keeps the handles a step apart, the opening within the day and the range under 24 hours. */
export function clampRange(
  open: number,
  close: number,
  moved: "open" | "close",
) {
  if (moved === "open") {
    const nextOpen = Math.min(Math.max(open, 0), day - step);
    return {
      open: nextOpen,
      close: Math.min(
        Math.max(close, nextOpen + step),
        nextOpen + day - step,
        trackEnd,
      ),
    };
  }
  const nextClose = Math.min(
    Math.max(close, open + step),
    open + day - step,
    trackEnd,
  );
  return { open, close: nextClose };
}

export const hourPresets = [
  { label: "Sáng", open: "06:00", close: "10:00" },
  { label: "Trưa", open: "10:00", close: "14:00" },
  { label: "Tối", open: "17:00", close: "22:00" },
  { label: "Cả ngày", open: "06:00", close: "22:00" },
  { label: "Xuyên đêm", open: "18:00", close: "02:00" },
];

const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30];

/**
 * One service range as a bar on a 24-hour track with an opening and a closing handle (15-minute
 * steps) and one-tap presets. Two native range inputs keep keyboard and screen-reader support.
 */
export function HoursRangeSlider({
  label,
  openTime,
  closeTime,
  onChange,
}: {
  label: string;
  openTime: string;
  closeTime: string;
  onChange: (openTime: string, closeTime: string) => void;
}) {
  const range = rangeOnTrack(openTime, closeTime);
  const shown = range ?? { open: 6 * 60, close: 22 * 60 };
  const percent = (minutes: number) => (minutes / trackEnd) * 100;
  const move = (value: number, moved: "open" | "close") => {
    const next = clampRange(
      moved === "open" ? value : shown.open,
      moved === "close" ? value : shown.close,
      moved,
    );
    onChange(toTime(next.open), toTime(next.close));
  };
  const overnight = shown.close > day;
  return (
    <div className="hours-slider" data-empty={!range || undefined}>
      <div
        className="hours-presets"
        role="group"
        aria-label={`Mẫu nhanh · ${label}`}
      >
        {hourPresets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            aria-pressed={
              openTime === preset.open && closeTime === preset.close
            }
            onClick={() => onChange(preset.open, preset.close)}
          >
            {preset.label}
            <small>
              {preset.open}–{preset.close}
            </small>
          </button>
        ))}
      </div>
      <p className="hours-slider-value" aria-live="polite">
        {range ? (
          <>
            <strong>
              {openTime} – {closeTime}
            </strong>
            {overnight && <span>đóng hôm sau</span>}
          </>
        ) : (
          <span>Kéo hai nút hoặc chọn một mẫu để đặt giờ</span>
        )}
      </p>
      <div
        className="hours-track"
        style={
          {
            "--from": `${percent(shown.open)}%`,
            "--to": `${percent(shown.close)}%`,
            "--midnight": `${percent(day)}%`,
          } as CSSProperties
        }
      >
        <span className="hours-track-next" aria-hidden />
        <span className="hours-track-fill" aria-hidden />
        <input
          type="range"
          min={0}
          max={trackEnd}
          step={step}
          value={shown.open}
          aria-label={`Giờ mở · ${label}`}
          aria-valuetext={range ? openTime : "Chưa đặt"}
          onChange={(event) => move(Number(event.target.value), "open")}
        />
        <input
          type="range"
          min={0}
          max={trackEnd}
          step={step}
          value={shown.close}
          aria-label={`Giờ đóng · ${label}`}
          aria-valuetext={
            range ? `${closeTime}${overnight ? " hôm sau" : ""}` : "Chưa đặt"
          }
          onChange={(event) => move(Number(event.target.value), "close")}
        />
      </div>
      <ol className="hours-ticks" aria-hidden>
        {ticks.map((hour) => (
          <li key={hour} style={{ left: `${percent(hour * 60)}%` }}>
            {hour === 24 ? "0h" : hour > 24 ? `${hour - 24}h` : `${hour}h`}
          </li>
        ))}
      </ol>
      <p className="hours-ticks-note" aria-hidden>
        <span>Trong ngày</span>
        <span>Hôm sau</span>
      </p>
    </div>
  );
}
