"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/shared/api/error";
import { agentService, type AgentService } from "./agent-service";
import {
  agentError,
  agentPollLimitMs,
  agentPollMs,
  agentStorageKey,
  agentTurnSettled,
  newAgentMessageId,
  rememberConversation,
  storedConversation,
  validationFromError,
} from "./agent-rules";
import type {
  AgentCommand,
  AgentCommit,
  AgentConfirmRequest,
  AgentConversation,
  AgentMessageRequest,
  AgentState,
  AgentValidation,
} from "./agent-types";

/** "failed" means the text can be sent again as a new message; "unknown" keeps it for a replay of the same message. */
export type AgentSendResult = "sent" | "failed" | "unknown";

/** Keeps the conversation alive when the sheet closes. Only its opaque ID is stored per user/roadmap. */
export function useAgentConversation({
  open,
  roadmapId,
  userId,
  onCommitted,
  service = agentService,
}: {
  open: boolean;
  roadmapId: number;
  userId: number;
  onCommitted: (id: number) => Promise<void>;
  service?: AgentService;
}) {
  const key = agentStorageKey(userId, roadmapId);
  const [conversation, setConversation] = useState<AgentConversation | null>(
    null,
  );
  const current = useRef<AgentConversation | null>(null);
  const mounted = useRef(false);
  const lock = useRef(false);
  const running = useRef<AbortController | null>(null);
  const initialRequest = useRef<Promise<AgentConversation> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [work, setWork] = useState<"" | "opening" | "sending" | "confirming">(
    "",
  );
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<AgentValidation | null>(null);
  const [stale, setStale] = useState(false);
  const [pending, setPending] = useState<AgentMessageRequest | null>(null);
  // Shown in the transcript from the moment of sending; the backend history only holds completed turns.
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] =
    useState<AgentConfirmRequest | null>(null);
  const [saved, setSaved] = useState<AgentCommit | null>(null);
  const [reloadFailed, setReloadFailed] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const publish = useCallback(
    (value: AgentConversation) => {
      if (!mounted.current) return;
      current.current = value;
      setConversation(value);
      rememberConversation(key, value.conversationId);
    },
    [key],
  );
  const report = useCallback(
    (caught: unknown) => {
      if (!mounted.current) return;
      const fields =
        caught instanceof ApiError
          ? Object.values(caught.errors ?? {}).flat()
          : [];
      setError([agentError(caught), ...fields].join(" "));
      setValidation(validationFromError(caught));
      if (
        caught instanceof ApiError &&
        ["CONVERSATION_NOT_FOUND", "CONVERSATION_EXPIRED"].includes(
          caught.errorCode,
        )
      ) {
        rememberConversation(key, null);
        const value = current.current;
        if (value) publish({ ...value, status: "expired", processing: false });
        setStale(true);
      }
    },
    [key, publish],
  );

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    // Sharing the promise also prevents two AGENT-01 calls during Strict Mode's effect replay.
    if (!initialRequest.current) {
      const id = current.current?.conversationId ?? storedConversation(key);
      initialRequest.current = (
        id ? service.get(id) : service.open(roadmapId)
      ).then((value) => {
        rememberConversation(key, value.conversationId);
        return value;
      });
    }
    const request = initialRequest.current;
    void request
      .then((value) => {
        if (!ignore) {
          publish(value);
          setStale(false);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!ignore) report(caught);
      })
      .finally(() => {
        if (initialRequest.current === request) initialRequest.current = null;
      });
    return () => {
      ignore = true;
    };
  }, [open, attempt, key, roadmapId, publish, report, service]);

  const refresh = useCallback(async () => {
    if (lock.current) return;
    const value = current.current;
    if (!value) {
      setAttempt((n) => n + 1);
      return;
    }
    lock.current = true;
    setWork("opening");
    try {
      publish(await service.get(value.conversationId));
      setStale(false);
      setError(null);
      setValidation(null);
    } catch (caught) {
      report(caught);
      setStale(true);
    } finally {
      lock.current = false;
      if (mounted.current) setWork("");
    }
  }, [publish, report, service]);

  const processingId = conversation?.processing
    ? conversation.conversationId
    : null;
  useEffect(() => {
    if (!open || !processingId || work) return;
    const id = processingId;
    let ignore = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    let failures = 0;
    async function poll() {
      if (ignore) return;
      if (Date.now() - started > agentPollLimitMs) {
        setError(
          "Mình vẫn đang xử lý yêu cầu của bạn. Bạn đợi thêm một chút rồi bấm Thử lại nhé.",
        );
        return;
      }
      if (document.visibilityState !== "hidden") {
        try {
          const value = await service.get(id);
          if (ignore) return;
          failures = 0;
          publish(value);
          setStale(false);
          if (!value.processing) {
            setError(null);
            setPending(null);
            setOutgoing(null);
            return;
          }
        } catch (caught) {
          if (ignore) return;
          failures += 1;
          if (
            (caught instanceof ApiError &&
              (caught.status === 404 || caught.status === 410)) ||
            failures >= 3
          ) {
            report(caught);
            return;
          }
        }
      }
      if (!ignore) timer = setTimeout(poll, agentPollMs);
    }
    timer = setTimeout(poll, agentPollMs);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [open, processingId, work, publish, report, service]);

  async function execute(body: AgentMessageRequest): Promise<AgentSendResult> {
    const value = current.current;
    if (!value || lock.current) return "failed";
    lock.current = true;
    setWork("sending");
    setError(null);
    setValidation(null);
    setPending(body);
    setOutgoing(body.content);
    setSaved(null);
    const abort = new AbortController();
    running.current = abort;
    try {
      const turn = await service.message(
        value.conversationId,
        body,
        abort.signal,
      );
      if (!mounted.current) return "failed";
      if (turn.status === "processing") {
        // The POST is acknowledged. From here only GET polls; reopening must not require a retry POST.
        setPending(null);
        publish({
          ...value,
          version: turn.conversationVersion,
          processing: true,
        });
      } else {
        setPending(null);
        // A replay may refer to an old proposal. Only GET may replace the current preview then.
        if (!turn.replayed) {
          setOutgoing(null);
          publish({
            ...value,
            version: turn.conversationVersion,
            processing: false,
            currentProposal: turn.proposal,
            messages: [
              ...value.messages,
              { role: "user", content: body.content },
              { role: "assistant", content: turn.reply },
            ],
          });
        }
        setValidation(turn.validation);
        setStale(true);
        publish(await service.get(value.conversationId));
        setOutgoing(null);
        setStale(false);
        setValidation(null);
        // A save said in chat changes the roadmap just like the save button.
        if (turn.commit) {
          setSaved(turn.commit);
          await reloadRoadmap(turn.commit);
        }
      }
      return "sent";
    } catch (caught) {
      if (!mounted.current) return "failed";
      if (abort.signal.aborted) {
        setPending(null);
        setOutgoing(null);
        // The backend decides what happened: a turn that finished just before the stop stays, and its text is not put back.
        try {
          const fresh = await service.get(value.conversationId);
          publish(fresh);
          setStale(false);
          return fresh.messages.length > value.messages.length
            ? "sent"
            : "failed";
        } catch {
          setStale(true);
          return "failed";
        }
      }
      report(caught);
      // Unknown outcome: keep the exact payload so "Thử lại" replays it instead of processing it twice.
      if (!agentTurnSettled(caught)) return "unknown";
      setPending(null);
      setOutgoing(null);
      // The failed attempt moved the version on. Reload quietly so the next message needs no extra step from the user.
      if (
        caught instanceof ApiError &&
        caught.status !== 404 &&
        caught.status !== 410
      ) {
        try {
          publish(await service.get(value.conversationId));
          setStale(false);
        } catch {
          setStale(true);
        }
      } else setStale(true);
      return "failed";
    } finally {
      running.current = null;
      lock.current = false;
      if (mounted.current) setWork("");
    }
  }
  function send(
    content: string,
    command: AgentCommand = "chat",
    selectedItemKey?: string,
    confirmedState?: AgentState,
  ) {
    const value = current.current;
    if (
      !value ||
      stale ||
      pending ||
      pendingConfirm ||
      value.processing ||
      value.status !== "active"
    )
      return Promise.resolve<AgentSendResult>("failed");
    return execute({
      clientMessageId: newAgentMessageId(),
      expectedConversationVersion: value.version,
      content,
      command,
      ...(selectedItemKey ? { selectedItemKey } : {}),
      ...(confirmedState ? { confirmedState } : {}),
    });
  }
  /** Replays the same message ID after an unknown outcome, under the conversation's current version. */
  async function retry() {
    const value = current.current;
    if (!pending || !value) return refresh();
    if (lock.current) return;
    setError(null);
    try {
      const fresh = await service.get(value.conversationId);
      publish(fresh);
      if (fresh.processing) return;
      await execute({ ...pending, expectedConversationVersion: fresh.version });
    } catch (caught) {
      report(caught);
    }
  }
  async function reloadRoadmap(commit: AgentCommit) {
    try {
      await onCommitted(commit.roadmapId);
      if (mounted.current) setReloadFailed(false);
    } catch {
      if (mounted.current) setReloadFailed(true);
    }
  }
  async function confirm(body: AgentConfirmRequest) {
    const value = current.current;
    if (!value || lock.current || saved || pending || value.processing) return;
    lock.current = true;
    setWork("confirming");
    setError(null);
    setValidation(null);
    setPendingConfirm(body);
    try {
      const commit = await service.confirm(value.conversationId, body);
      if (!mounted.current) return;
      setSaved(commit);
      setPendingConfirm(null);
      if (value.currentProposal)
        publish({
          ...value,
          currentProposal: { ...value.currentProposal, status: "committed" },
        });
      await reloadRoadmap(commit);
    } catch (caught) {
      report(caught);
      if (
        caught instanceof ApiError &&
        [400, 404, 409, 410].includes(caught.status)
      ) {
        setPendingConfirm(null);
        setStale(true);
        try {
          publish(await service.get(value.conversationId));
        } catch {
          /* Keep the original actionable error. */
        }
      }
    } finally {
      lock.current = false;
      if (mounted.current) setWork("");
    }
  }
  function newConversation() {
    if (lock.current || pendingConfirm) return;
    rememberConversation(key, null);
    current.current = null;
    setConversation(null);
    setPending(null);
    setOutgoing(null);
    setSaved(null);
    setStale(false);
    setError(null);
    setValidation(null);
    setAttempt((n) => n + 1);
  }
  return {
    conversation,
    work,
    error,
    validation,
    stale,
    pending,
    outgoing,
    pendingConfirm,
    saved,
    reloadFailed,
    send,
    /** Cancels the message being sent; the backend gives up the turn and saves nothing from it. */
    stop: () => running.current?.abort(),
    refresh,
    retry,
    confirm,
    newConversation,
    retryRoadmap: () => (saved ? reloadRoadmap(saved) : Promise.resolve()),
  };
}
