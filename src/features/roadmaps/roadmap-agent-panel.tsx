"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button } from "@/shared/ui";
import { ConfirmDialog, TextArea } from "@/components/ui/primitives";
import { DateField } from "@/components/ui/date-time-fields";
import { dateLabel } from "@/shared/format";
import { AgentConstraintsDialog } from "./agent-constraints-dialog";
import { AgentProposalPreview, AgentValidationNotice } from "./agent-proposal";
import {
  agentMessageError,
  agentMessageLimit,
  canConfirmProposal,
  standaloneValidation,
} from "./agent-rules";
import type { useAgentConversation } from "./use-agent-conversation";
import { roadmapDetailHref } from "./routes";
import { vnd } from "./roadmap-list-rules";
import { roadmapEndDate } from "./roadmap-rules";
import type { AgentConfirmRequest } from "./agent-types";
import "./roadmap-agent.css";

const prompts = [
  "Gợi ý bữa trưa theo ngân sách",
  "Tìm quán có món chay",
  "Món đặc trưng nên thử",
];

/** Non-modal sheet: covers the notebook while the existing map stays mounted and interactive. */
export function RoadmapAgentPanel({
  open,
  onClose,
  agent,
  selected,
  onSelect,
  previewDay,
  onPreviewDay,
  mapView,
  onShowMap,
}: {
  open: boolean;
  onClose: () => void;
  /** Owned by the roadmap screen, which also draws the current preview on its map. */
  agent: ReturnType<typeof useAgentConversation>;
  selected: string;
  onSelect: (itemKey: string) => void;
  previewDay: number;
  onPreviewDay: (day: number) => void;
  /** On small screens this panel covers the map; true while it steps aside to reveal it. */
  mapView: boolean;
  onShowMap: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [decision, setDecision] = useState<"reset" | "discard" | null>(null);
  const [confirmation, setConfirmation] = useState<AgentConfirmRequest | null>(
    null,
  );
  const [saveDate, setSaveDate] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const { conversation, work } = agent;
  const proposal = conversation?.currentProposal;
  const knownStartDate =
    conversation?.state.startDate ?? proposal?.snapshot.state.startDate ?? "";
  const plannedDays = proposal?.snapshot.state.numDays ?? 1;
  const saveEndDate = saveDate
    ? roadmapEndDate(saveDate, String(plannedDays))
    : null;
  const blocked =
    !conversation ||
    conversation.status !== "active" ||
    conversation.processing ||
    !!work ||
    agent.stale ||
    !!agent.pending ||
    !!agent.pendingConfirm;

  useEffect(() => {
    if (!open) return;
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const header = document.querySelector<HTMLElement>(
      ".app-shell .site-header-bar",
    );
    const wasInert = header?.inert;
    if (header) header.inert = true;
    const frame = requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLTextAreaElement>("textarea")
        ?.focus({ preventScroll: true }),
    );
    return () => {
      cancelAnimationFrame(frame);
      if (header) header.inert = wasInert ?? false;
      returnFocus?.focus({ preventScroll: true });
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open]);
  useEffect(() => {
    if (open && transcript.current)
      transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [open, conversation?.messages.length, conversation?.processing]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const messageError = agentMessageError(content);
    setInputError(messageError);
    if (messageError || blocked) return;
    if (await agent.send(content.trim(), "chat", selected || undefined))
      setContent("");
  }
  function focusPrompt(prompt: string) {
    setContent(prompt);
    setInputError(null);
    root.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  }
  const readyToConfirm =
    !!conversation &&
    !blocked &&
    !agent.saved &&
    canConfirmProposal(conversation, now);

  return (
    <section
      ref={root}
      id="roadmap-agent-panel"
      className="roadmap-agent-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="roadmap-agent-title"
      aria-hidden={!open || mapView}
      inert={!open || mapView}
      data-open={open}
      data-map-view={mapView}
      onKeyDown={(event) => {
        if (
          event.key === "Escape" &&
          !event.defaultPrevented &&
          !document.querySelector("dialog[open]")
        ) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header className="agent-header">
        <h2 id="roadmap-agent-title">
          ANGI <span aria-hidden>/</span> Trợ lý ăn uống
        </h2>
        <Button
          variant="secondary"
          onClick={onClose}
          aria-label="Đóng trợ lý món ăn"
        >
          Đóng —
        </Button>
      </header>
      <p className="agent-disclaimer">
        Thông tin do AI tạo cần được kiểm tra lại.
      </p>
      <div className="agent-scroll" ref={transcript}>
        {(!conversation || conversation.messages.length === 0) && (
          <div className="agent-welcome">
            <h3>
              Bạn muốn khám phá món gì
              {conversation?.state.province
                ? ` ở ${conversation.state.province}`
                : ""}
              ?
            </h3>
            <div className="agent-prompts">
              {prompts.map((prompt) => (
                <Button
                  key={prompt}
                  variant="secondary"
                  disabled={blocked}
                  onClick={() => focusPrompt(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        )}
        {!conversation && !agent.error && (
          <p role="status">Đang mở hội thoại…</p>
        )}
        {conversation && (
          <>
            {conversation.messages.length > 0 && (
              <div
                className="agent-transcript"
                role="log"
                aria-label="Lịch sử trao đổi"
                aria-live="polite"
                aria-relevant="additions"
              >
                {conversation.messages.map((message, index) => (
                  <article
                    className={`agent-message agent-message-${message.role}`}
                    key={`${index}-${message.role}`}
                  >
                    <p className="agent-message-author">
                      {message.role === "user" ? "Bạn" : "ANGI"}
                    </p>
                    <p>{message.content}</p>
                  </article>
                ))}
              </div>
            )}
            {(work === "sending" || conversation.processing) && (
              <p className="agent-processing" role="status">
                <span className="spinner" aria-hidden />
                Trợ lý đang xử lý yêu cầu…
              </p>
            )}
          </>
        )}
        {agent.error && (
          <div className="stack-sm">
            <Alert>{agent.error}</Alert>
            <div className="agent-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  void agent.refresh();
                }}
                disabled={!!work}
              >
                Kiểm tra hội thoại
              </Button>
              {agent.pending && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    void agent.retry();
                  }}
                  disabled={!!work || !!conversation?.processing}
                >
                  Gửi lại tin nhắn
                </Button>
              )}
              {(!conversation || conversation.status !== "active") && (
                <Button onClick={agent.newConversation} disabled={!!work}>
                  Mở hội thoại mới
                </Button>
              )}
            </div>
          </div>
        )}
        <AgentValidationNotice
          validation={standaloneValidation(agent.validation, proposal)}
        />
        {conversation && conversation.status !== "active" && !agent.error && (
          <Alert tone="warning">
            Hội thoại đã đóng hoặc hết hạn; lộ trình đã lưu vẫn được giữ.
            <Button variant="secondary" onClick={agent.newConversation}>
              Mở hội thoại mới
            </Button>
          </Alert>
        )}
        {proposal && (
          <AgentProposalPreview
            proposal={proposal}
            active={open}
            selectedKey={selected}
            onSelect={onSelect}
            disabled={blocked || !!agent.saved}
            day={previewDay}
            onDay={onPreviewDay}
            onShowMap={onShowMap}
            onAlternative={() => {
              void agent.send(
                "Tìm phương án khác cho phần đang chọn.",
                "alternative",
                selected || undefined,
              );
            }}
          />
        )}
        {proposal && !agent.saved && (
          <div className="agent-actions">
            <Button
              disabled={!readyToConfirm}
              onClick={() => {
                setSaveDate(knownStartDate);
                setConfirmation({
                  proposalId: proposal.proposalId,
                  proposalVersion: proposal.version,
                });
              }}
            >
              Xác nhận lưu vào lộ trình
            </Button>
            <Button
              variant="secondary"
              disabled={blocked}
              onClick={() => setDecision("discard")}
            >
              Bỏ bản nháp
            </Button>
            {Date.parse(proposal.expiresAt) <= now && (
              <p className="helper">
                Bản nháp đã hết hạn. Hãy yêu cầu phương án mới.
              </p>
            )}
          </div>
        )}
        {agent.pendingConfirm && !work && (
          <Alert tone="warning">
            Chưa xác định được kết quả lưu. Hãy kiểm tra lại đúng lần xác nhận
            này trước khi gửi yêu cầu khác.
            <Button
              variant="secondary"
              onClick={() => {
                const request = agent.pendingConfirm;
                if (request) void agent.confirm(request);
              }}
            >
              Kiểm tra lại lần lưu
            </Button>
          </Alert>
        )}
        {agent.saved && (
          <div className="stack-sm">
            <Alert tone="success">Đã lưu thay đổi vào lộ trình.</Alert>
            {agent.reloadFailed ? (
              <Alert tone="warning">
                Đã lưu thành công nhưng chưa tải lại được lộ trình.
                <Button
                  variant="secondary"
                  onClick={() => {
                    void agent.retryRoadmap();
                  }}
                >
                  Tải lại lộ trình
                </Button>
              </Alert>
            ) : (
              <Link
                className="text-link"
                href={roadmapDetailHref(agent.saved.roadmapId)}
              >
                Mở lộ trình đã lưu
              </Link>
            )}
          </div>
        )}
      </div>
      <div className="agent-composer-area">
        {conversation && (
          <div className="agent-context">
            <span>
              {conversation.state.budgetUnrestricted
                ? "Không giới hạn ngân sách"
                : conversation.state.budgetAmount === null
                  ? "Chưa đặt ngân sách"
                  : `${vnd(conversation.state.budgetAmount)} / người / chuyến`}
            </span>
            <div>
              <Button
                variant="tertiary"
                disabled={blocked}
                onClick={() => setConstraintsOpen(true)}
              >
                Điều kiện chuyến đi
              </Button>
              <Button
                variant="tertiary"
                disabled={blocked}
                onClick={() => setDecision("reset")}
              >
                Bắt đầu lại
              </Button>
            </div>
          </div>
        )}
        {selected && (
          <p className="agent-selected">
            Đang trao đổi về{" "}
            {proposal?.snapshot.items.find((item) => item.itemKey === selected)
              ?.dishName ?? "món đã chọn"}
            <button
              type="button"
              aria-label="Bỏ chọn món trong chat"
              onClick={() => onSelect("")}
              disabled={blocked}
            >
              ×
            </button>
          </p>
        )}
        <form className="agent-composer" onSubmit={send}>
          <div className="agent-input-row">
            <TextArea
              label="Yêu cầu với trợ lý món ăn"
              placeholder="Nhập yêu cầu về món ăn hoặc quán…"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setInputError(null);
              }}
              rows={1}
              maxLength={agentMessageLimit}
              error={inputError ?? undefined}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <Button
              type="submit"
              disabled={blocked || !content.trim()}
              loading={work === "sending"}
            >
              Gửi
            </Button>
          </div>
          <p className="helper">Enter để gửi, Shift + Enter để xuống dòng.</p>
        </form>
      </div>
      <ConfirmDialog
        open={!!confirmation}
        title="Lưu bản nháp vào lộ trình?"
        label="Xác nhận lưu"
        loading={work === "confirming"}
        onClose={() => {
          if (!work) setConfirmation(null);
        }}
        onConfirm={() => {
          if (
            !confirmation ||
            !readyToConfirm ||
            !conversation ||
            !canConfirmProposal(conversation, Date.now()) ||
            confirmation.proposalId !== proposal?.proposalId ||
            confirmation.proposalVersion !== proposal.version
          ) {
            setConfirmation(null);
            return;
          }
          void agent
            .confirm({
              ...confirmation,
              ...(saveDate && saveDate !== knownStartDate
                ? { startDate: saveDate }
                : {}),
            })
            .finally(() => setConfirmation(null));
        }}
      >
        <p>
          Những thay đổi trong bản nháp sẽ được áp dụng vào lộ trình sau khi hệ
          thống kiểm tra lại.
        </p>
        <DateField
          label="Ngày bắt đầu"
          value={saveDate}
          onChange={setSaveDate}
          helper="Chưa biết ngày đi thì để trống, bạn có thể chọn sau."
        />
        <p className="helper">
          Lịch có {plannedDays} ngày
          {saveDate && saveEndDate
            ? `, từ ${dateLabel(saveDate)} đến ${dateLabel(saveEndDate)}.`
            : "."}
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={decision !== null}
        title={
          decision === "reset"
            ? "Bắt đầu lại cuộc trò chuyện?"
            : "Bỏ bản nháp hiện tại?"
        }
        onClose={() => setDecision(null)}
        onConfirm={() => {
          if (decision)
            void agent.send(
              decision === "reset"
                ? "Bắt đầu lại cuộc trò chuyện, giữ lộ trình đã lưu."
                : "Bỏ bản nháp này, giữ lộ trình đã lưu.",
              decision,
            );
          setDecision(null);
        }}
      >
        <p>
          Lộ trình đã lưu vẫn được giữ nguyên.{" "}
          {decision === "reset"
            ? "Trợ lý sẽ quên những gì hai bên vừa trao đổi."
            : "Bản nháp này sẽ không được áp dụng."}
        </p>
      </ConfirmDialog>
      {constraintsOpen && conversation && (
        <AgentConstraintsDialog
          state={conversation.state}
          onClose={() => setConstraintsOpen(false)}
          onSubmit={(state) => {
            setConstraintsOpen(false);
            void agent.send(
              "Mình xác nhận điều kiện chuyến đi theo biểu mẫu, bạn dùng đúng các giá trị này nhé.",
              "chat",
              selected || undefined,
              state,
            );
          }}
        />
      )}
    </section>
  );
}
