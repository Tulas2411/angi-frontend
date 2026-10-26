import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/server";
import { RoadmapDetailPage } from "@/features/roadmaps/roadmap-detail-page";
import {
  parseDayParam,
  parseRoadmapId,
  parseTabParam,
} from "@/features/roadmaps/roadmap-detail-rules";

export const metadata: Metadata = { title: "Chi tiết lộ trình" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ roadmapId: string }>;
  searchParams: Promise<{ day?: string | string[]; tab?: string | string[] }>;
}) {
  // RM-03 and RM-14 are Traveler-only operations.
  const user = await requireUser(["TRAVELER"]);
  const roadmapId = parseRoadmapId((await params).roadmapId);
  if (roadmapId === null) notFound();
  const { day, tab } = await searchParams;
  return (
    <div className="roadmap-detail-page">
      <RoadmapDetailPage
        roadmapId={roadmapId}
        userId={user.id}
        initialDay={parseDayParam(day)}
        initialTab={parseTabParam(tab)}
      />
    </div>
  );
}
