"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Alert, Button } from "@/shared/ui";
import { Icon } from "@/components/ui/primitives";
import {
  formatDistance,
  formatDuration,
  mealSlotLabels,
} from "./roadmap-detail-rules";
import { vnd } from "./roadmap-list-rules";
import { roadmapDayTone } from "./roadmap-map-rules";
import {
  agentDayLegs,
  agentDishName,
  agentMapDays,
  agentMapStops,
  type AgentLeg,
} from "./agent-map-rules";
import { agentService } from "./agent-service";
import type { AgentProposal, AgentValidation } from "./agent-types";

export function AgentValidationNotice({
  validation,
}: {
  validation: AgentValidation | null;
}) {
  if (!validation) return null;
  return (
    <>
      {validation.errors.length > 0 && (
        <Alert>
          <ul>
            {validation.errors.map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ul>
        </Alert>
      )}
      {validation.warnings.length > 0 && (
        <Alert tone="warning">
          <ul>
            {validation.warnings.map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ul>
        </Alert>
      )}
    </>
  );
}

const statuses: Record<AgentProposal["status"], string> = {
  ready: "Chờ bạn xác nhận",
  invalid: "Cần điều chỉnh",
  superseded: "Đã có bản mới",
  committed: "Đã lưu",
  discarded: "Đã bỏ bản nháp",
  expired: "Đã hết hạn",
};

function LegRow({ leg }: { leg: AgentLeg }) {
  return (
    <p className="agent-leg">
      <Icon name="motorcycle" />
      {leg.fromOrigin && "Từ điểm xuất phát: "}
      <strong>{formatDistance(leg.distanceMeters)}</strong>
      {" · "}
      {leg.isEstimated && "Khoảng "}
      {formatDuration(leg.durationSeconds)}
    </p>
  );
}

export function AgentProposalPreview({
  proposal,
  active,
  selectedKey,
  day,
  onDay,
  onShowMap,
  children,
}: {
  proposal: AgentProposal;
  active: boolean;
  /** The dish whose pin is chosen on the map. */
  selectedKey: string;
  /** Day shown here and on the map; both always follow the same day. */
  day: number;
  onDay: (day: number) => void;
  /** Reveals the map on screens where this panel covers it. */
  onShowMap: () => void;
  /** What the traveler can do next, at the end of the card. */
  children?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const reported = useRef(new Set<string>());
  const days = agentMapDays(proposal);
  const stops = agentMapStops(proposal).filter(
    (stop) => stop.dayNumber === day,
  );
  // Stops arrive in meal order, so each meal is one consecutive run.
  const meals = stops.reduce<(typeof stops)[]>((groups, stop) => {
    const last = groups.at(-1);
    if (last?.[0].item.mealSlot === stop.item.mealSlot) last.push(stop);
    else groups.push([stop]);
    return groups;
  }, []);
  const route = proposal.validation.routes.find(
    (entry) => entry.dayNumber === day,
  );
  const legs = agentDayLegs(proposal, day);
  const note = (dishId: number) =>
    proposal.snapshot.dishNotes?.find((entry) => entry.dishId === dishId);
  const daySummary = proposal.snapshot.daySummaries?.find(
    (entry) => entry.dayNumber === day,
  )?.summary;
  const { budgetAmount, budgetUnrestricted } = proposal.snapshot.state;
  useEffect(() => {
    if (!active || !root.current) return;
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const queued = new Map<string, Set<number>>();
    async function flush() {
      const batches = [...queued];
      queued.clear();
      await Promise.allSettled(
        batches.map(([requestId, ids]) =>
          agentService.impressions(requestId, [...ids]),
        ),
      );
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          const requestId = element.dataset.requestId;
          const dishId = Number(element.dataset.dishId);
          const key = `${requestId}:${dishId}`;
          const previous = timers.get(element);
          if (previous) clearTimeout(previous);
          timers.delete(element);
          if (
            entry.isIntersecting &&
            entry.intersectionRatio >= 0.5 &&
            requestId &&
            !reported.current.has(key)
          ) {
            timers.set(
              element,
              setTimeout(() => {
                timers.delete(element);
                reported.current.add(key);
                const ids = queued.get(requestId) ?? new Set<number>();
                ids.add(dishId);
                queued.set(requestId, ids);
              }, 1000),
            );
          }
        }
      },
      { threshold: [0, 0.5] },
    );
    root.current
      .querySelectorAll("[data-request-id]")
      .forEach((element) => observer.observe(element));
    const interval = setInterval(() => {
      void flush();
    }, 2500);
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
      clearInterval(interval);
      void flush();
    };
  }, [active, proposal, day]);
  // A pin chosen on the map brings its dish into view here.
  useEffect(() => {
    if (!selectedKey) return;
    root.current
      ?.querySelector(`[data-item-key="${CSS.escape(selectedKey)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedKey]);
  return (
    <section
      className="agent-proposal"
      aria-label="Bản nháp của trợ lý"
      data-version={proposal.version}
    >
      <div className="agent-proposal-head">
        <h3>{proposal.snapshot.state.title}</h3>
        <span className="agent-proposal-status" data-status={proposal.status}>
          {statuses[proposal.status]}
        </span>
      </div>
      <p className="agent-proposal-total">
        <span className="helper">Tổng dự chi</span>
        <strong>{vnd(proposal.validation.totalCost)}</strong>
        {budgetAmount !== null && !budgetUnrestricted && (
          <span className="helper">Ngân sách {vnd(budgetAmount)}</span>
        )}
      </p>
      <AgentValidationNotice validation={proposal.validation} />
      {days.length > 1 && (
        <div
          className="agent-proposal-days"
          role="group"
          aria-label="Chọn ngày trong bản nháp"
        >
          {days.map((value) => (
            <button
              key={value}
              type="button"
              data-tone={roadmapDayTone(value)}
              aria-pressed={value === day}
              onClick={() => onDay(value)}
            >
              Ngày {value}
            </button>
          ))}
        </div>
      )}
      <Button
        variant="secondary"
        className="agent-map-toggle"
        onClick={onShowMap}
      >
        Xem trên bản đồ
      </Button>
      <div className="agent-day" data-tone={roadmapDayTone(day)}>
        <h4 className="agent-day-title">Ngày {day}</h4>
        {stops.length > 0 && (
          <p className="helper">
            {stops.length} món ·{" "}
            {vnd(stops.reduce((sum, stop) => sum + stop.item.price, 0))}
          </p>
        )}
        {route?.originSkipped && (
          <p className="helper">
            Bỏ chặng từ điểm xuất phát do cách quán đầu quá 30 km.
          </p>
        )}
        {stops.length > 0 ? (
          <div className="agent-proposal-items" ref={root}>
            {meals.map((group) => (
              <div className="agent-meal" key={group[0].item.itemKey}>
                {legs.get(group[0].item.itemKey) && (
                  <LegRow leg={legs.get(group[0].item.itemKey)!} />
                )}
                <h5 className="roadmap-meal-heading">
                  {mealSlotLabels[group[0].item.mealSlot]}
                </h5>
                <ol className="roadmap-items">
                  {group.map(({ item, number, coordinate, changed }, index) => (
                    <li key={item.itemKey}>
                      {index > 0 && legs.get(item.itemKey) && (
                        <LegRow leg={legs.get(item.itemKey)!} />
                      )}
                      <div
                        className="agent-proposal-item"
                        data-selected={selectedKey === item.itemKey}
                        data-request-id={item.requestId || undefined}
                        data-dish-id={item.dishId}
                        data-item-key={item.itemKey}
                        data-changed={changed}
                      >
                        <span className="agent-proposal-item-name">
                          <span className="roadmap-item-order" aria-hidden>
                            {number}
                          </span>
                          <strong>{agentDishName(item)}</strong>
                          {changed && (
                            <span className="agent-proposal-new">Món mới</span>
                          )}
                        </span>
                        <span className="roadmap-item-price">
                          Dự chi {vnd(item.price)}
                        </span>
                        <span className="helper">
                          {item.restaurantName ?? "Chưa có tên quán"}
                        </span>
                        {!coordinate && (
                          <span className="helper">
                            Chưa có vị trí trên bản đồ
                          </span>
                        )}
                        {note(item.dishId)?.intro && (
                          <span className="agent-proposal-intro">
                            {note(item.dishId)?.intro}
                          </span>
                        )}
                        {note(item.dishId)?.reason && (
                          <span className="agent-proposal-reason">
                            {note(item.dishId)?.reason}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ) : (
          <p className="helper">
            {proposal.snapshot.items.length === 0
              ? "Không còn món trong bản nháp này."
              : "Ngày này chưa có món."}
          </p>
        )}
        {daySummary && <p className="agent-day-summary">{daySummary}</p>}
      </div>
      {children}
    </section>
  );
}
