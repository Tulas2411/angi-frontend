/** Integrated Traveler roadmap routes (backed by the real RM endpoints). */
export const roadmapRoutes = {
  list: "/roadmaps",
  plan: "/roadmaps/new",
} as const;

export function roadmapListHref(page: number) {
  return page > 1 ? `${roadmapRoutes.list}?page=${page}` : roadmapRoutes.list;
}
