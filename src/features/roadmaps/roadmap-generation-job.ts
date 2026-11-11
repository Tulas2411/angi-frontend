/**
 * RM-10 runs in the background and the API has no "which job is running" call, so the job id
 * is remembered in this browser only. Reopening the dialog can then follow a job that was
 * started before it was closed (otherwise RM-10 would answer GENERATION_IN_PROGRESS).
 */
const key = (roadmapId: number) => `angi:roadmap-generation:${roadmapId}`;

export function rememberGenerationJob(roadmapId: number, jobId: number) {
  try {
    window.localStorage.setItem(key(roadmapId), String(jobId));
  } catch {
    // Private mode or blocked storage: the traveler just waits for the notification instead.
  }
}

export function recallGenerationJob(roadmapId: number): number | null {
  try {
    const value = Number(window.localStorage.getItem(key(roadmapId)));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function forgetGenerationJob(roadmapId: number) {
  try {
    window.localStorage.removeItem(key(roadmapId));
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}
