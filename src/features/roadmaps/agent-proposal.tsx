"use client";
import { useEffect, useRef } from "react";
import { Alert, Button } from "@/shared/ui";
import { mealSlotLabels } from "./roadmap-detail-rules";
import { vnd } from "./roadmap-list-rules";
import { proposalItems } from "./agent-rules";
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

export function AgentProposalPreview({
  proposal,
  active,
  selectedKey,
  onSelect,
  disabled,
  onAlternative,
}: {
  proposal: AgentProposal;
  active: boolean;
  selectedKey: string;
  onSelect: (key: string) => void;
  disabled: boolean;
  onAlternative: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const reported = useRef(new Set<string>());
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
  }, [active, proposal]);
  return (
    <section className="agent-proposal" aria-label="Bản xem trước của trợ lý">
      <div className="between">
        <div>
          <p className="eyebrow">Bản xem trước · V{proposal.version}</p>
          <h3>{proposal.snapshot.state.title}</h3>
        </div>
        <span className="agent-proposal-status">
          {statuses[proposal.status]}
        </span>
      </div>
      <p className="helper">
        {proposal.operation === "update"
          ? "Thay đổi lộ trình hiện tại"
          : "Tạo lộ trình mới"}{" "}
        · Chưa áp dụng trước khi xác nhận.
      </p>
      <p>
        <strong>Tổng dự chi: {vnd(proposal.validation.totalCost)}</strong>
      </p>
      <AgentValidationNotice validation={proposal.validation} />
      {proposal.snapshot.state.pendingQuestion && (
        <Alert tone="warning">{proposal.snapshot.state.pendingQuestion}</Alert>
      )}
      <div className="agent-proposal-items" ref={root}>
        {proposalItems(proposal).map((item) => (
          <button
            type="button"
            key={item.itemKey}
            className="agent-proposal-item"
            aria-pressed={selectedKey === item.itemKey}
            disabled={disabled}
            onClick={() =>
              onSelect(selectedKey === item.itemKey ? "" : item.itemKey)
            }
            data-request-id={item.requestId || undefined}
            data-dish-id={item.dishId}
          >
            <span className="helper">
              Ngày {item.dayNumber} · {mealSlotLabels[item.mealSlot]}
            </span>
            <strong>{item.dishName ?? `Món #${item.dishId}`}</strong>
            <span>{item.restaurantName ?? "Chưa có tên quán"}</span>
            <span>{vnd(item.price)}</span>
            {selectedKey === item.itemKey && (
              <span className="helper">Đang chọn để trao đổi với trợ lý</span>
            )}
          </button>
        ))}
        {proposal.snapshot.items.length === 0 && (
          <p>Không còn món trong bản nháp này.</p>
        )}
      </div>
      {proposal.snapshot.changes && proposal.snapshot.changes.length > 0 && (
        <p className="helper">
          Thay đổi:{" "}
          {proposal.snapshot.changes
            .map(
              (change) =>
                ({
                  add: "thêm",
                  replace: "thay món",
                  remove: "xóa",
                  move: "chuyển bữa",
                })[change.type],
            )
            .join(", ")}
          .
        </p>
      )}
      {proposal.validation.routes.map((route) => (
        <div key={route.dayNumber} className="agent-route-summary">
          <p>
            Ngày {route.dayNumber}:{" "}
            {(route.totalDistanceMeters / 1000).toLocaleString("vi-VN", {
              maximumFractionDigits: 2,
            })}{" "}
            km · {Math.ceil(route.totalDurationSeconds / 60)} phút{" "}
            {route.isEstimated && <strong>· Ước tính</strong>}
          </p>
          {route.originSkipped && (
            <p className="helper">
              Bỏ chặng từ điểm xuất phát do cách quán đầu quá 30 km.
            </p>
          )}
        </div>
      ))}
      <Button
        variant="secondary"
        onClick={onAlternative}
        disabled={
          disabled ||
          (proposal.status !== "ready" && proposal.status !== "invalid")
        }
      >
        Tìm phương án khác{selectedKey ? " cho món đã chọn" : ""}
      </Button>
    </section>
  );
}
