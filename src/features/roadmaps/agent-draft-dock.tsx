"use client";
import { useState, type ReactNode } from "react";
import { DateField } from "@/components/ui/date-time-fields";
import { dateToIso } from "@/components/ui/date-time-rules";
import Link from "next/link";
import {
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/20/solid";
import { Alert, Button } from "@/shared/ui";
import { agentMapDays } from "./agent-map-rules";
import { vnd } from "./roadmap-list-rules";
import { roadmapDetailHref } from "./routes";
import type { AgentCommit, AgentProposal } from "./agent-types";

export const agentDraftSheetId = "agent-draft-sheet";
export const agentDraftCollapseId = "agent-draft-collapse";

/** In the open draft's title row: folds the sheet back into its card. */
export function AgentDraftCollapse({ onCollapse }: { onCollapse: () => void }) {
  return (
    <button
      type="button"
      id={agentDraftCollapseId}
      className="agent-draft-collapse"
      aria-expanded
      aria-controls={agentDraftSheetId}
      aria-label="Thu gọn lịch nháp"
      title="Thu gọn"
      onClick={onCollapse}
    >
      <ChevronDownIcon aria-hidden />
    </button>
  );
}

/** What the draft card says about the draft, in a few words. */
const statusLabels: Record<AgentProposal["status"], string> = {
  ready: "Chờ bạn xác nhận",
  invalid: "Cần điều chỉnh",
  superseded: "Đã có bản mới",
  committed: "Đã thêm",
  discarded: "Đã bỏ",
  expired: "Đã hết hạn",
};

/**
 * The draft card docked on the top edge of the composer: the draft's title, its days and total.
 * Pressing it slides the whole draft up over the conversation (AgentDraftSheet) and the card
 * steps aside; the draft's own title row then holds the collapse button (AgentDraftCollapse).
 * "mới" marks a draft the traveler has not opened yet.
 */
export function AgentDraftTab({
  proposal,
  saved,
  expired,
  open,
  unseen,
  onToggle,
}: {
  proposal: AgentProposal;
  saved: boolean;
  expired: boolean;
  open: boolean;
  /** A new draft (or a new version) the traveler has not opened yet. */
  unseen: boolean;
  onToggle: () => void;
}) {
  const days = agentMapDays(proposal).length;
  const status = saved
    ? "committed"
    : expired && proposal.status === "ready"
      ? "expired"
      : proposal.status;
  return (
    <button
      type="button"
      className="agent-draft-tab"
      aria-expanded={open}
      aria-controls={agentDraftSheetId}
      data-open={open}
      onClick={onToggle}
    >
      <CalendarDaysIcon className="agent-draft-tab-icon" aria-hidden />
      <span className="agent-draft-tab-text">
        <span className="agent-draft-tab-eyebrow">
          Lịch nháp
          {unseen && (
            <span className="agent-draft-tab-new">
              <span className="sr-only">, </span>mới
            </span>
          )}
        </span>
        <strong>{proposal.snapshot.state.title}</strong>
        <span className="agent-draft-tab-meta">
          {days > 0 && `${days} ngày · `}
          {vnd(proposal.validation.totalCost)}
        </span>
      </span>
      <span className="agent-draft-tab-status" data-status={status}>
        {statusLabels[status]}
      </span>
      <ChevronUpIcon className="agent-draft-tab-chevron" aria-hidden />
      <span className="sr-only">
        {open ? "Thu gọn lịch nháp" : "Mở lịch nháp"}
      </span>
    </button>
  );
}

/**
 * The draft, slid up over the conversation from the card. The preview scrolls; "Thêm vào lịch
 * trình" stays at the bottom and saves the draft as it is shown (AGENT-04 confirm), so the
 * traveler no longer has to type a save phrase. Changing a dish is still done by chatting.
 * When neither the draft nor the conversation knows the first day, a date field sits beside the
 * button (optional: left empty, the roadmap is saved without dates, as before).
 */
export function AgentDraftSheet({
  open,
  proposal,
  expired,
  saved,
  reloadFailed,
  confirming,
  canConfirm,
  needsDate,
  error,
  onConfirm,
  onRetryRoadmap,
  children,
}: {
  open: boolean;
  proposal: AgentProposal;
  expired: boolean;
  saved: AgentCommit | null;
  reloadFailed: boolean;
  confirming: boolean;
  /** False while the conversation is busy (a reply on its way, a stale draft, a pending turn). */
  canConfirm: boolean;
  /** No start date yet: offer one beside the button. */
  needsDate: boolean;
  /** The last error of the conversation, the failed save included. */
  error: string | null;
  /** `startDate` (yyyy-MM-dd) only when the traveler picked one here. */
  onConfirm: (startDate?: string) => void;
  onRetryRoadmap: () => void;
  /** The draft itself (AgentProposalPreview). */
  children: ReactNode;
}) {
  const ready = proposal.status === "ready" && !expired && !saved;
  const [startDate, setStartDate] = useState("");
  return (
    <section
      id={agentDraftSheetId}
      className="agent-draft-sheet"
      aria-label="Lịch nháp của trợ lý"
      data-open={open}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="agent-draft-sheet-scroll">
        {children}
        {ready && (
          <p className="helper agent-draft-hint">
            Muốn đổi món? Cứ nhắn cho trợ lý, bản nháp sẽ cập nhật.
          </p>
        )}
      </div>
      <footer className="agent-draft-actions">
        {/* Only while open: the conversation shows the same error when the sheet is folded. */}
        {open && error && !saved && <Alert>{error}</Alert>}
        {saved ? (
          reloadFailed ? (
            <Alert tone="warning">
              Đã thêm vào lịch trình nhưng chưa tải lại được lộ trình.
              <Button variant="secondary" onClick={onRetryRoadmap}>
                Tải lại lộ trình
              </Button>
            </Alert>
          ) : (
            <Alert tone="success">
              Đã thêm vào lịch trình.{" "}
              <Link
                className="text-link"
                href={roadmapDetailHref(saved.roadmapId)}
              >
                Mở lộ trình
              </Link>
            </Alert>
          )
        ) : expired ? (
          <p className="helper">
            Bản nháp đã hết hạn. Hãy nhắn để trợ lý lập phương án mới.
          </p>
        ) : ready ? (
          <div
            className="agent-draft-confirm-row"
            data-with-date={needsDate || undefined}
          >
            {needsDate && (
              <DateField
                label="Ngày bắt đầu (không bắt buộc)"
                value={startDate}
                min={dateToIso(new Date())}
                onChange={setStartDate}
                disabled={confirming}
                // At the foot of the fixed assistant panel: the calendar opens upwards.
                pickerSide="top"
              />
            )}
            <Button
              className="agent-draft-confirm"
              loading={confirming}
              disabled={!canConfirm}
              onClick={() =>
                onConfirm(needsDate && startDate ? startDate : undefined)
              }
            >
              Thêm vào lịch trình
            </Button>
          </div>
        ) : (
          <p className="helper">
            {proposal.status === "invalid"
              ? "Bản nháp cần điều chỉnh trước khi thêm. Hãy nhắn cho trợ lý."
              : "Bản nháp này không còn dùng được."}
          </p>
        )}
      </footer>
    </section>
  );
}
