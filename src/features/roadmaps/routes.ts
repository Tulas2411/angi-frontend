/** Integrated Traveler roadmap routes (backed by the real RM endpoints). */
export const roadmapRoutes = {
  list: "/roadmaps",
  plan: "/roadmaps/new",
  /** Redirects to `plan` when the Traveler has no roadmap yet, otherwise to `list`. */
  start: "/roadmaps/start",
} as const;

export function roadmapListHref(page: number) {
  return page > 1 ? `${roadmapRoutes.list}?page=${page}` : roadmapRoutes.list;
}

/**
 * `/roadmaps/88`, `/roadmaps/88?tab=budget` or `/roadmaps/88?day=2`. The default view
 * (itinerary, first day) has no query.
 */
export function roadmapDetailHref(
  roadmapId: number,
  view: {
    tab?: "overview" | "itinerary" | "budget";
    day?: number;
    /** The unfolded days, so a reload opens them again (every day starts folded otherwise). */
    open?: readonly number[];
  } = {},
) {
  const query = new URLSearchParams();
  if (view.tab && view.tab !== "itinerary") query.set("tab", view.tab);
  if (view.day && view.day > 1) query.set("day", String(view.day));
  // Day numbers only, so the commas stay readable instead of URLSearchParams' %2C.
  const open = view.open?.length
    ? `open=${[...new Set(view.open)].sort((a, b) => a - b).join(",")}`
    : "";
  const text = [query.toString(), open].filter(Boolean).join("&");
  return `${roadmapRoutes.list}/${roadmapId}${text ? `?${text}` : ""}`;
}
