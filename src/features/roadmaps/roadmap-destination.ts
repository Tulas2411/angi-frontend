/**
 * The trip's province. Since 2026-11-08 the roadmap keeps it (`destinationProvince`, RM-01 /
 * RM-04); roadmaps made before that only have the copy this browser remembered when planning.
 * RM-06 needs the province on every call, and the map centres on it when nothing else is shown.
 */
const key = (roadmapId: number) => `angi:roadmap-destination:${roadmapId}`;

export function rememberDestination(roadmapId: number, province: string) {
  const value = province.trim();
  if (!value) return;
  try {
    window.localStorage.setItem(key(roadmapId), value);
  } catch {
    // Private mode or blocked storage: the traveler simply picks the province again.
  }
}

export function recallDestination(roadmapId: number): string {
  try {
    return window.localStorage.getItem(key(roadmapId)) ?? "";
  } catch {
    return "";
  }
}

/** The saved destination of the roadmap, else the one this browser remembered for it. */
export function roadmapDestination(overview: {
  id: number;
  destinationProvince?: string | null;
}): string {
  return overview.destinationProvince?.trim() || recallDestination(overview.id);
}
