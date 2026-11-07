"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { notify } from "@/shared/ui/notify";
import {
  createdItemCount,
  generationDoneText,
  generationFailureText,
  generationJobError,
  generationMaxWaitMs,
  generationPollMs,
  maxPollFailures,
  type GenerateForm,
} from "./roadmap-generate-rules";
import {
  forgetGenerationJob,
  recallGenerationJob,
  rememberGenerationJob,
} from "./roadmap-generation-job";
import type { RoadmapGenerationService } from "./roadmap-service";
import type { GenerationJobDto } from "./roadmap-types";

export type GenerationWatchState =
  | { kind: "idle" }
  | {
      kind: "running";
      jobId: number;
      job: GenerationJobDto | null;
      /** Set when the job takes too long or cannot be read; "Kiểm tra lại" looks again. */
      stalled: string | null;
      /** What was asked, for the progress line; null for a job followed again after a reload. */
      submitted: GenerateForm | null;
    }
  | { kind: "failed"; message: string }
  /** Finished while hidden: the background worker fades out, then the state goes idle. */
  | { kind: "leaving" };

/** How long the background worker takes to fade out (matches roadmap-generate.css). */
export const workerFadeMs = 400;

/**
 * F-26 job follow-up (RM-11), owned by the roadmap screen rather than the dialog, so it keeps
 * running when the traveler hides the dialog ("Ẩn, ANGI vẫn tạo ở nền"). A job remembered in this
 * browser (roadmap-generation-job.ts) is followed again when the screen opens.
 *
 * A success is always told by a toast: the dialog, when shown, closes (onSucceededInDialog); hidden,
 * the worker fades. A failure shown in the dialog stays there, with "Chỉnh điều kiện".
 */
export function useGenerationWatch({
  roadmapId,
  service,
  onGenerated,
  onSucceededInDialog,
}: {
  roadmapId: number;
  service: RoadmapGenerationService;
  /** The job succeeded: the parent reloads the roadmap (RM-03); rejects when that fails. */
  onGenerated: () => Promise<void>;
  /** The job succeeded while the dialog was shown: the parent closes it (the toast tells the rest). */
  onSucceededInDialog: () => void;
}) {
  const [state, setState] = useState<GenerationWatchState>(() => {
    const remembered = recallGenerationJob(roadmapId);
    return remembered
      ? {
          kind: "running",
          jobId: remembered,
          job: null,
          stalled: null,
          submitted: null,
        }
      : { kind: "idle" };
  });
  const [round, setRound] = useState(0);
  // A remembered job may already be finished: the first look is immediate.
  const firstLook = useRef(state.kind === "running");
  // Whether the dialog is hidden; read when the job ends, so it is a ref, not state.
  const hidden = useRef(true);
  const latestGenerated = useRef(onGenerated);
  const latestSucceeded = useRef(onSucceededInDialog);
  useEffect(() => {
    latestGenerated.current = onGenerated;
    latestSucceeded.current = onSucceededInDialog;
  });

  const jobId = state.kind === "running" ? state.jobId : null;
  useEffect(() => {
    if (jobId === null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const started = Date.now();
    const update = (
      patch: Partial<Extract<GenerationWatchState, { kind: "running" }>>,
    ) =>
      setState((previous) =>
        previous.kind === "running" ? { ...previous, ...patch } : previous,
      );
    /** The end, in the dialog when it is shown, otherwise as a toast while the worker fades. */
    const finish = (
      end:
        | { kind: "done"; job: GenerationJobDto; reloadFailed: boolean }
        | Extract<GenerationWatchState, { kind: "failed" }>,
    ) => {
      // A failure in the open dialog stays there, with "Chỉnh điều kiện".
      if (!hidden.current && end.kind === "failed") {
        setState(end);
        return;
      }
      if (end.kind === "done") {
        notify.success(generationDoneText(createdItemCount(end.job)));
        if (end.reloadFailed)
          notify.warning(
            "Lịch đã được tạo nhưng chưa tải lại được lộ trình. Hãy tải lại trang để xem đầy đủ.",
          );
      } else notify.error(end.message);
      // Shown: the dialog closes; no worker to fade out.
      if (!hidden.current) {
        setState({ kind: "idle" });
        latestSucceeded.current();
        return;
      }
      setState({ kind: "leaving" });
      setTimeout(
        () =>
          setState((previous) =>
            previous.kind === "leaving" ? { kind: "idle" } : previous,
          ),
        workerFadeMs,
      );
    };

    function later() {
      if (Date.now() - started >= generationMaxWaitMs) {
        update({
          stalled:
            "ANGI đang tạo lâu hơn dự kiến. Lịch sẽ xuất hiện khi xong và ANGI sẽ gửi thông báo.",
        });
        return;
      }
      timer = setTimeout(poll, generationPollMs);
    }
    async function poll() {
      try {
        const current = await service.generationJob(roadmapId, jobId!);
        if (cancelled) return;
        failures = 0;
        update({ job: current });
        if (current.status === "succeeded") {
          forgetGenerationJob(roadmapId);
          let reloadFailed = false;
          try {
            await latestGenerated.current();
          } catch {
            reloadFailed = true;
          }
          if (!cancelled) finish({ kind: "done", job: current, reloadFailed });
        } else if (current.status === "failed") {
          forgetGenerationJob(roadmapId);
          finish({ kind: "failed", message: generationFailureText(current) });
        } else later();
      } catch (caught) {
        if (cancelled) return;
        const failure = generationJobError(caught);
        if (failure.missing) {
          forgetGenerationJob(roadmapId);
          finish({ kind: "failed", message: failure.message });
        } else if (++failures >= maxPollFailures)
          update({
            stalled: `Chưa kiểm tra được tiến trình: ${failure.message} ANGI vẫn tiếp tục tạo ở nền.`,
          });
        else later();
      }
    }
    timer = setTimeout(poll, firstLook.current ? 0 : generationPollMs);
    firstLook.current = false;
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // `service` is stable for the life of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, round]);

  /** RM-10 queued a job: follow it. */
  const start = useCallback(
    (id: number, submitted: GenerateForm | null) => {
      rememberGenerationJob(roadmapId, id);
      setState({
        kind: "running",
        jobId: id,
        job: null,
        stalled: null,
        submitted,
      });
    },
    [roadmapId],
  );
  /** "Kiểm tra lại" after a stall. */
  const retry = useCallback(() => {
    setState((previous) =>
      previous.kind === "running" ? { ...previous, stalled: null } : previous,
    );
    setRound((value) => value + 1);
  }, []);
  /** Back to the form ("Chỉnh điều kiện") or the end acknowledged ("Xem lộ trình"). */
  const reset = useCallback(() => setState({ kind: "idle" }), []);
  /** The dialog is shown or hidden: decides where the end is told. */
  const setHidden = useCallback((value: boolean) => {
    hidden.current = value;
  }, []);

  return { state, start, retry, reset, setHidden };
}

export type GenerationWatch = ReturnType<typeof useGenerationWatch>;
