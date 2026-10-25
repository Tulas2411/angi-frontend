/**
 * A roadmap keeps no destination (RM-01), but RM-06 needs the province on every call. The
 * province typed when planning is remembered in this browser only, as a convenience; it is
 * never sent anywhere and the dialog also falls back to the provinces of the added dishes.
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
