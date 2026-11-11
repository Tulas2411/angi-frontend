import { NextResponse } from "next/server";
import { HOME_BY_ROLE } from "@/features/auth/roles";
import {
  backend,
  getSession,
  readAuth,
  withAuth,
} from "@/features/auth/server";
import type { RoadmapPageDto } from "@/features/roadmaps/roadmap-types";
import { roadmapRoutes } from "@/features/roadmaps/routes";

export const runtime = "nodejs";

/**
 * Header "Lộ trình": a Traveler without any roadmap goes straight to the planner, otherwise to
 * the list. It runs as a Route Handler because RM-02 may rotate the session tokens.
 */
export async function GET(request: Request) {
  const to = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));
  const session = await getSession();
  const auth = readAuth(session);
  if (!auth) return to("/login");
  if (auth.user.role !== "TRAVELER") return to(HOME_BY_ROLE[auth.user.role]);
  try {
    const page = await withAuth(session, (current) =>
      backend<RoadmapPageDto>("roadmaps?page=1&pageSize=1", {
        token: current.accessToken,
      }),
    );
    return to(page.totalItems > 0 ? roadmapRoutes.list : roadmapRoutes.plan);
  } catch {
    // The list page shows its own error and retry when RM-02 is unavailable.
    return to(roadmapRoutes.list);
  }
}
