import type { Metadata } from "next";
import { requireUser } from "@/features/auth/server";
import { PlanRoadmapPage } from "@/features/roadmaps/plan-roadmap-page";

export const metadata: Metadata = { title: "Lập lộ trình mới" };

export default async function Page() {
  // RM-01 / RM-04 are Traveler-only operations.
  await requireUser(["TRAVELER"]);
  return <PlanRoadmapPage />;
}
