"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button } from "@/shared/ui";
import { ConfirmDialog, TextArea } from "@/components/ui/primitives";
import { AgentConstraintsDialog } from "./agent-constraints-dialog";
import { AgentProposalPreview, AgentValidationNotice } from "./agent-proposal";
import {
  agentMessageError,
  agentMessageLimit,
  canConfirmProposal,
} from "./agent-rules";
import { useAgentConversation } from "./use-agent-conversation";
import { roadmapDetailHref } from "./routes";
import { vnd } from "./roadmap-list-rules";
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
  roadmapId,
  userId,
  onCommitted,
}: {
  open: boolean;
  onClose: () => void;
  roadmapId: number;
  userId: number;
  onCommitted: (id: number) => Promise<void>;
}) {
  const agent = useAgentConversation({ open, roadmapId, userId, onCommitted });
  const root = useRef<HTMLElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [decision, setDecision] = useState<"reset" | "discard" | null>(null);
  const [confirmation, setConfirmation] = useState<AgentConfirmRequest | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());
  const { conversation, work } = agent;
  const proposal = conversation?.currentProposal;
  const selected = proposal?.snapshot.items.some(
    (item) => item.itemKey === selectedKey,
  )
    ? selectedKey
    : "";
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
      aria-hidden={!open}
      inert={!open}
      data-open={open}
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
                  Thử lại đúng tin nhắn
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
        <AgentValidationNotice validation={agent.validation} />
        {conversation && conversation.status !== "active" && !agent.error && (
          <Alert tone="warning">
            Hội thoại đã đóng hoặc hết hạn; lộ trình đã lưu vẫn được giữ.
            <Button variant="secondary" onClick={agent.newConversation}>
              Mở hội thoại mới
            </Button>
          </Alert>
        )}
        {conversation?.state.pendingQuestion && (
          <p className="agent-question">{conversation.state.pendingQuestion}</p>
        )}
        {proposal && (
          <AgentProposalPreview
            proposal={proposal}
            active={open}
            selectedKey={selected}
            onSelect={setSelectedKey}
            disabled={blocked || !!agent.saved}
            onAlternative={() => {
              void agent.send(
                "Tìm phương án khác trong phạm vi đang chọn.",
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
              onClick={() =>
                setConfirmation({
                  proposalId: proposal.proposalId,
                  proposalVersion: proposal.version,
                })
              }
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
                Bản xem trước đã hết hạn. Hãy yêu cầu phương án mới.
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
                Ràng buộc
              </Button>
              <Button
                variant="tertiary"
                disabled={blocked}
                onClick={() => setDecision("reset")}
              >
                Làm mới
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
              onClick={() => setSelectedKey("")}
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
          <p className="helper">
            Bản xem trước chỉ được lưu khi bạn xác nhận. Enter để gửi, Shift +
            Enter để xuống dòng.
          </p>
        </form>
      </div>
      <ConfirmDialog
        open={!!confirmation}
        title="Lưu bản xem trước vào lộ trình?"
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
          void agent.confirm(confirmation).finally(() => setConfirmation(null));
        }}
      >
        <p>
          Bạn đang xác nhận bản V{confirmation?.proposalVersion}. Những thay đổi
          trong bản xem trước sẽ được áp dụng vào lộ trình sau khi hệ thống kiểm
          tra lại.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={decision !== null}
        title={
          decision === "reset"
            ? "Làm mới ngữ cảnh trợ lý?"
            : "Bỏ bản nháp hiện tại?"
        }
        onClose={() => setDecision(null)}
        onConfirm={() => {
          if (decision)
            void agent.send(
              decision === "reset"
                ? "Làm mới ngữ cảnh hội thoại, giữ lộ trình đã lưu."
                : "Bỏ bản nháp hiện tại, giữ lộ trình đã lưu.",
              decision,
            );
          setDecision(null);
        }}
      >
        <p>
          Lộ trình đã lưu vẫn được giữ nguyên.{" "}
          {decision === "reset"
            ? "Trợ lý sẽ bắt đầu lại ngữ cảnh."
            : "Bản xem trước này sẽ không được áp dụng."}
        </p>
      </ConfirmDialog>
      {constraintsOpen && conversation && (
        <AgentConstraintsDialog
          state={conversation.state}
          onClose={() => setConstraintsOpen(false)}
          onSubmit={(state) => {
            setConstraintsOpen(false);
            void agent.send(
              "Tôi xác nhận các ràng buộc trong biểu mẫu. Hãy dùng đúng các giá trị này.",
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
