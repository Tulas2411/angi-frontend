"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/shared/api/error";
import { agentService, type AgentService } from "./agent-service";
import {
  agentError,
  agentPollLimitMs,
  agentPollMs,
  agentStorageKey,
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
  const initialRequest = useRef<Promise<AgentConversation> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [work, setWork] = useState<"" | "opening" | "sending" | "confirming">(
    "",
  );
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<AgentValidation | null>(null);
  const [stale, setStale] = useState(false);
  const [pending, setPending] = useState<AgentMessageRequest | null>(null);
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
          "Trợ lý vẫn đang xử lý. Bấm Kiểm tra hội thoại để xem kết quả; không cần gửi lại tin nhắn.",
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

  async function execute(body: AgentMessageRequest) {
    const value = current.current;
    if (!value || lock.current) return false;
    lock.current = true;
    setWork("sending");
    setError(null);
    setValidation(null);
    setPending(body);
    setSaved(null);
    try {
      const turn = await service.message(value.conversationId, body);
      if (!mounted.current) return false;
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
        if (!turn.replayed)
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
        setValidation(turn.validation);
        setStale(true);
        publish(await service.get(value.conversationId));
        setStale(false);
        setValidation(null);
      }
      return true;
    } catch (caught) {
      if (!mounted.current) return false;
      report(caught);
      if (
        caught instanceof ApiError &&
        (caught.status === 400 ||
          caught.status === 404 ||
          caught.status === 409 ||
          caught.status === 410)
      ) {
        setPending(null);
        setStale(true);
        if (caught.status === 409) {
          try {
            publish(await service.get(value.conversationId));
            setStale(false);
          } catch (reloadError) {
            report(reloadError);
          }
        }
      }
      return false;
    } finally {
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
      return Promise.resolve(false);
    return execute({
      clientMessageId: newAgentMessageId(),
      expectedConversationVersion: value.version,
      content,
      command,
      ...(selectedItemKey ? { selectedItemKey } : {}),
      ...(confirmedState ? { confirmedState } : {}),
    });
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
    pendingConfirm,
    saved,
    reloadFailed,
    send,
    refresh,
    retry: () => (pending ? execute(pending) : refresh()),
    confirm,
    newConversation,
    retryRoadmap: () => (saved ? reloadRoadmap(saved) : Promise.resolve()),
  };
}
