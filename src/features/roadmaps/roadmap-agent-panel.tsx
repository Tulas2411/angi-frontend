"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button } from "@/shared/ui";
import { Avatar, TextArea } from "@/components/ui/primitives";
import { AgentConstraintsDialog } from "./agent-constraints-dialog";
import { AgentProposalPreview, AgentValidationNotice } from "./agent-proposal";
import {
  agentLocationProblem,
  agentLocationState,
  agentMessageError,
  agentMessageLimit,
  agentPromptSuggestions,
  agentQuickReply,
  agentReplyBlocks,
  agentRevealNext,
  mentionsCurrentLocation,
  standaloneValidation,
  type AgentInline,
  type AgentPanelMode,
} from "./agent-rules";
import type { useAgentConversation } from "./use-agent-conversation";
import { roadmapDetailHref } from "./routes";
import { vnd } from "./roadmap-list-rules";
import "./roadmap-agent.css";

const disclaimer = "Gợi ý từ Trợ lý món ăn có thể chưa hoàn toàn chính xác.";

const glyphs = {
  expand: <rect x="3.5" y="5" width="13" height="10" rx="1.5" />,
  restore: (
    <>
      <rect x="3.5" y="7" width="9.5" height="9" rx="1.5" />
      <path d="M7 4h7.5A1.5 1.5 0 0 1 16 5.5V13" />
    </>
  ),
  minimize: <path d="M4 10h12" />,
  info: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 9.5V14M10 6.2v.3" />
    </>
  ),
  suggestion: (
    <path d="M5 4.5v4A2.5 2.5 0 0 0 7.5 11H15m-3.5-3.5L15 11l-3.5 3.5" />
  ),
  send: <path d="M10 16V4.5M5 9.5l5-5 5 5" />,
  stop: <rect x="6" y="6" width="8" height="8" rx="1" fill="currentColor" />,
};
function Glyph({ name }: { name: keyof typeof glyphs }) {
  return (
    <svg
      className="agent-glyph"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyphs[name]}
    </svg>
  );
}

function AssistantMark() {
  return (
    <span className="agent-avatar agent-mark" aria-hidden="true">
      AI
    </span>
  );
}

function ReplyLine({
  parts,
  onSelect,
}: {
  parts: readonly AgentInline[];
  onSelect: (itemKey: string) => void;
}) {
  return parts.map((part, index) =>
    part.kind === "item" ? (
      <button
        key={index}
        type="button"
        className="agent-reply-link"
        onClick={() => onSelect(part.itemKey)}
      >
        {part.text}
      </button>
    ) : part.kind === "strong" ? (
      <strong key={index}>{part.text}</strong>
    ) : (
      part.text
    ),
  );
}

/** Reply text stays plain data here: paragraphs, lists, bold and links to the draft's own dishes. */
function AssistantReply({
  text,
  items,
  onSelect,
}: {
  text: string;
  items: Parameters<typeof agentReplyBlocks>[1];
  onSelect: (itemKey: string) => void;
}) {
  return agentReplyBlocks(text, items).map((block, index) => {
    if (block.kind === "paragraph")
      return (
        <p key={index}>
          {block.lines.map((line, position) => (
            <span key={position}>
              {position > 0 && <br />}
              <ReplyLine parts={line} onSelect={onSelect} />
            </span>
          ))}
        </p>
      );
    const List = block.kind === "bullets" ? "ul" : "ol";
    return (
      <List key={index}>
        {block.items.map((line, position) => (
          <li key={position}>
            <ReplyLine parts={line} onSelect={onSelect} />
          </li>
        ))}
      </List>
    );
  });
}

/** Non-modal assistant: a popup over the map or a panel over the notebook; the map stays mounted and interactive. */
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
  mode,
  compact,
  onToggleMode,
  roadmapTitle,
  userName,
  userAvatar,
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
  mode: AgentPanelMode;
  /** Small screens always use the full panel, with no popup to switch to. */
  compact: boolean;
  onToggleMode: () => void;
  roadmapTitle: string;
  userName: string;
  userAvatar: string | null;
}) {
  const root = useRef<HTMLElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { conversation, work } = agent;
  const proposal = conversation?.currentProposal;
  // A reply that just arrived appears word by word; the backend sends it whole, once it has passed validation.
  const messages = conversation?.messages;
  const messageCount = messages?.length ?? null;
  const [seenCount, setSeenCount] = useState<number | null>(null);
  const [reveal, setReveal] = useState<{
    index: number;
    text: string;
    shown: number;
  } | null>(null);
  if (messageCount !== seenCount) {
    setSeenCount(messageCount);
    const last = messages?.at(-1);
    if (
      seenCount !== null &&
      messageCount !== null &&
      messageCount > seenCount &&
      last?.role === "assistant" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      setReveal({ index: messageCount - 1, text: last.content, shown: 0 });
  }
  const revealing = reveal !== null;
  const blocked =
    !conversation ||
    conversation.status !== "active" ||
    conversation.processing ||
    !!work ||
    agent.stale ||
    !!agent.pending ||
    locating ||
    revealing;
  const quickReply = agentQuickReply(conversation);
  const state = conversation?.state;
  const thinking = work === "sending" || !!conversation?.processing;
  // A turn that is only being polled has no open request left to cancel.
  const stoppable = work === "sending" || revealing;
  const empty =
    (!conversation || conversation.messages.length === 0) &&
    !agent.outgoing &&
    !proposal;
  // Names in a reply link to pins only while those pins are on the map.
  const replyItems =
    proposal?.status === "ready" && !agent.saved ? proposal.snapshot.items : [];
  const closed = !!conversation && conversation.status !== "active";
  const canRetry =
    !closed &&
    (!!agent.pending ||
      agent.stale ||
      !conversation ||
      conversation.processing);

  useEffect(() => {
    if (!open) return;
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLTextAreaElement>("textarea")
        ?.focus({ preventScroll: true }),
    );
    return () => {
      cancelAnimationFrame(frame);
      returnFocus?.focus({ preventScroll: true });
    };
  }, [open]);
  // The full panel covers the site header; the popup leaves it usable.
  const coversHeader = mode === "expanded";
  useEffect(() => {
    if (!open || !coversHeader) return;
    const header = document.querySelector<HTMLElement>(
      ".app-shell .site-header-bar",
    );
    const wasInert = header?.inert;
    if (header) header.inert = true;
    return () => {
      if (header) header.inert = wasInert ?? false;
    };
  }, [open, coversHeader]);
  // The composer grows with its text up to the height set in CSS.
  useEffect(() => {
    const input = root.current?.querySelector<HTMLTextAreaElement>("textarea");
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }, [content]);
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open]);
  useEffect(() => {
    if (!revealing) return;
    const timer = setInterval(
      () =>
        setReveal((current) => {
          if (!current) return null;
          const shown = agentRevealNext(current.text, current.shown);
          return shown >= current.text.length ? null : { ...current, shown };
        }),
      40,
    );
    return () => clearInterval(timer);
  }, [revealing]);
  useEffect(() => {
    if (open && transcript.current)
      transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [
    open,
    conversation?.messages.length,
    conversation?.processing,
    agent.outgoing,
    agent.error,
    reveal?.shown,
    revealing,
  ]);

  /** A failed send puts the text back unless the user has started typing something else. */
  function restore(
    text: string,
    result: Awaited<ReturnType<typeof agent.send>>,
  ) {
    if (result === "failed") setContent((value) => value || text);
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    const messageError = agentMessageError(content);
    setInputError(messageError);
    if (messageError || blocked) return;
    const text = content.trim();
    // The composer empties at once; the message is already visible in the transcript.
    setContent("");
    if (mentionsCurrentLocation(text) && state?.originMode !== "gps") {
      shareLocation(text, true);
      return;
    }
    restore(text, await agent.send(text));
  }
  /**
   * Asks the browser only after this action. Without coordinates, a typed request reaches the backend only
   * when it can answer without the model; otherwise the text waits in the composer with the reason.
   */
  function shareLocation(text: string, typed: boolean) {
    const refused = (code: number | null) => {
      setLocating(false);
      setInputError(agentLocationProblem(code, window.isSecureContext));
      if (typed && !state?.province)
        void agent.send(text).then((result) => restore(text, result));
      else if (typed) setContent((value) => value || text);
    };
    if (!state || !navigator.geolocation) {
      refused(null);
      return;
    }
    setInputError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        void agent
          .send(
            text,
            "chat",
            undefined,
            agentLocationState(state, coords.latitude, coords.longitude),
          )
          .then((result) => {
            if (typed) restore(text, result);
          });
      },
      (error) => refused(error.code),
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  function sendPrompt(prompt: string) {
    setInputError(null);
    void agent.send(prompt).then((result) => restore(prompt, result));
  }
  /** While a reply is being revealed it already exists, so stopping just shows the rest of it. */
  function stop() {
    if (revealing) setReveal(null);
    else agent.stop();
    root.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  }

  return (
    <section
      ref={root}
      id="roadmap-agent-panel"
      className="roadmap-agent-panel"
      role="dialog"
      aria-modal="false"
      aria-label="Trợ lý món ăn"
      aria-hidden={!open || mapView}
      inert={!open || mapView}
      data-open={open}
      data-map-view={mapView}
      data-mode={mode}
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
        <h2 className="agent-header-title">{roadmapTitle}</h2>
        <div className="agent-header-actions">
          {!compact && (
            <Button
              variant="icon"
              aria-label={
                mode === "popup" ? "Mở rộng trợ lý" : "Thu về cửa sổ nhỏ"
              }
              title={mode === "popup" ? "Mở rộng" : "Thu về cửa sổ nhỏ"}
              onClick={onToggleMode}
            >
              <Glyph name={mode === "popup" ? "expand" : "restore"} />
            </Button>
          )}
          <Button
            variant="icon"
            aria-label="Đóng trợ lý món ăn"
            title="Đóng"
            onClick={onClose}
          >
            <Glyph name="minimize" />
          </Button>
        </div>
      </header>
      <div className="agent-scroll" ref={transcript}>
        {empty && (
          <div className="agent-welcome">
            <p className="agent-disclaimer">
              <Glyph name="info" />
              <span>{disclaimer}</span>
            </p>
            <h3>Chưa biết ăn gì? Thử hỏi:</h3>
            <div className="agent-prompts">
              {agentPromptSuggestions(conversation?.state).map((prompt) => (
                <Button
                  key={prompt}
                  variant="secondary"
                  disabled={blocked}
                  onClick={() => sendPrompt(prompt)}
                >
                  <Glyph name="suggestion" />
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
            {(conversation.messages.length > 0 || agent.outgoing) && (
              <div
                className="agent-transcript"
                role="log"
                aria-label="Lịch sử trao đổi"
                aria-live="polite"
                aria-relevant="additions"
                aria-busy={revealing}
              >
                {conversation.messages.map((message, index) => (
                  <article
                    className={`agent-message agent-message-${message.role}`}
                    key={`${index}-${message.role}`}
                  >
                    {message.role === "user" ? (
                      <span aria-hidden="true">
                        <Avatar
                          className="agent-avatar"
                          name={userName}
                          image={userAvatar}
                        />
                      </span>
                    ) : (
                      <AssistantMark />
                    )}
                    <div className="agent-message-body">
                      <p className="agent-message-author sr-only">
                        {message.role === "user" ? "Bạn" : "ANGI"}
                      </p>
                      {message.role === "user" ? (
                        <p>{message.content}</p>
                      ) : (
                        <AssistantReply
                          text={
                            reveal?.index === index
                              ? reveal.text.slice(0, reveal.shown)
                              : message.content
                          }
                          items={replyItems}
                          onSelect={onSelect}
                        />
                      )}
                    </div>
                  </article>
                ))}
                {agent.outgoing && (
                  <article className="agent-message agent-message-user">
                    <span aria-hidden="true">
                      <Avatar
                        className="agent-avatar"
                        name={userName}
                        image={userAvatar}
                      />
                    </span>
                    <div className="agent-message-body">
                      <p className="agent-message-author sr-only">Bạn</p>
                      <p>{agent.outgoing}</p>
                    </div>
                  </article>
                )}
              </div>
            )}
            {thinking && (
              <div className="agent-message agent-message-assistant">
                <AssistantMark />
                <p className="agent-thinking" role="status">
                  <span className="sr-only">Trợ lý đang trả lời</span>
                  <span aria-hidden="true" />
                  <span aria-hidden="true" />
                  <span aria-hidden="true" />
                </p>
              </div>
            )}
          </>
        )}
        {agent.error && (
          <article
            className="agent-message agent-message-assistant agent-message-error"
            role="alert"
          >
            <AssistantMark />
            <div className="agent-message-body">
              <p className="agent-message-author sr-only">ANGI</p>
              <p>{agent.error}</p>
              {canRetry && (
                <Button
                  variant="tertiary"
                  onClick={() => {
                    void agent.retry();
                  }}
                  disabled={!!work}
                >
                  Thử lại
                </Button>
              )}
              {closed && (
                <Button
                  variant="tertiary"
                  onClick={agent.newConversation}
                  disabled={!!work}
                >
                  Mở hội thoại mới
                </Button>
              )}
            </div>
          </article>
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
        {proposal && !revealing && (
          <AgentProposalPreview
            proposal={proposal}
            active={open}
            selectedKey={selected}
            day={previewDay}
            onDay={onPreviewDay}
            onShowMap={onShowMap}
          >
            {/* The draft is saved, changed and dropped in chat; these are the phrases the backend acts on without the model. */}
            {!agent.saved &&
              (Date.parse(proposal.expiresAt) <= now ? (
                <p className="helper">
                  Bản nháp đã hết hạn. Hãy yêu cầu phương án mới.
                </p>
              ) : (
                proposal.status === "ready" && (
                  <p className="helper">
                    Chưa lưu. Nhắn “lưu lịch này” để lưu, “bỏ bản nháp” để bỏ,
                    hoặc cứ nói món bạn muốn đổi.
                  </p>
                )
              ))}
          </AgentProposalPreview>
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
        {quickReply && (
          <div className="agent-quick-replies">
            {quickReply === "current-location" ? (
              <Button
                variant="secondary"
                disabled={blocked}
                loading={locating}
                onClick={() =>
                  shareLocation("Dùng vị trí hiện tại của mình", false)
                }
              >
                Dùng vị trí hiện tại
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={blocked}
                onClick={() => {
                  void agent.send("Không, lập lịch luôn nhé.");
                }}
              >
                Không, lập lịch luôn
              </Button>
            )}
          </div>
        )}
        <form className="agent-composer" onSubmit={send}>
          <TextArea
            label="Yêu cầu với trợ lý món ăn"
            placeholder={
              empty
                ? "Hỏi các câu hỏi liên quan đến ẩm thực"
                : 'Hỏi các câu hỏi liên quan đến ẩm thực như "Ăn gì ở phố cổ?"'
            }
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
          <div className="agent-composer-row">
            {conversation && (
              <button
                type="button"
                className="agent-composer-budget"
                aria-label="Điều kiện chuyến đi"
                title="Đổi điều kiện chuyến đi"
                disabled={blocked}
                onClick={() => setConstraintsOpen(true)}
              >
                {conversation.state.budgetUnrestricted
                  ? "Không giới hạn ngân sách"
                  : conversation.state.budgetAmount === null
                    ? "Chưa đặt ngân sách"
                    : `${vnd(conversation.state.budgetAmount)} / người / chuyến`}
              </button>
            )}
            {stoppable ? (
              <Button
                key="stop"
                variant="icon"
                className="agent-send"
                aria-label="Dừng trả lời"
                title="Dừng"
                onClick={stop}
              >
                <span className="agent-send-glyph">
                  <Glyph name="stop" />
                </span>
              </Button>
            ) : thinking ? (
              <Button
                key="busy"
                variant="icon"
                className="agent-send"
                aria-label="Đang xử lý"
                disabled
              >
                <span className="agent-send-glyph">
                  <Glyph name="stop" />
                </span>
              </Button>
            ) : (
              <Button
                key="send"
                type="submit"
                variant="icon"
                className="agent-send"
                aria-label="Gửi"
                data-state={content.trim() ? "ready" : "empty"}
                disabled={blocked || !content.trim()}
              >
                <span className="agent-send-glyph">
                  <Glyph name="send" />
                </span>
              </Button>
            )}
          </div>
        </form>
        <p className="agent-footnote">{disclaimer}</p>
      </div>
      {constraintsOpen && conversation && (
        <AgentConstraintsDialog
          state={conversation.state}
          onClose={() => setConstraintsOpen(false)}
          onSubmit={(state) => {
            setConstraintsOpen(false);
            void agent.send(
              "Mình xác nhận điều kiện chuyến đi theo biểu mẫu, bạn dùng đúng các giá trị này nhé.",
              "chat",
              undefined,
              state,
            );
          }}
        />
      )}
    </section>
  );
}
