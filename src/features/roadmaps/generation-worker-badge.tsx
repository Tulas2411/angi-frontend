"use client";
import { AngiPeek } from "./angi-worker";
import { workerFadeMs } from "./roadmap-generation-watch";

/**
 * ANGI working in the background: its head peeks in from the right edge of the screen, with a
 * speech bubble of typing dots above it, after the traveler hides the generation dialog. Pressing
 * it opens the progress again. When the job ends it slides back behind the edge (`leaving`) while
 * a toast tells the result.
 */
export function GenerationWorkerBadge({
  leaving,
  onOpen,
}: {
  leaving: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={`generation-worker ${leaving ? "is-leaving" : ""}`.trim()}
      style={{ ["--worker-fade" as string]: `${workerFadeMs}ms` }}
      aria-label="ANGI đang lên lịch ở nền. Mở tiến trình"
      title="ANGI đang lên lịch… Bấm để xem tiến trình"
      disabled={leaving}
      onClick={onOpen}
    >
      <AngiPeek />
      <span className="generation-worker-bubble" aria-hidden>
        <i />
        <i />
        <i />
      </span>
    </button>
  );
}
