import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/server";
import { RoadmapDetailPage } from "@/features/roadmaps/roadmap-detail-page";
import {
  parseDayParam,
  parseOpenParam,
  parseRoadmapId,
  parseTabParam,
  pickRoadmapHeroImage,
} from "@/features/roadmaps/roadmap-detail-rules";

export const metadata: Metadata = { title: "Chi tiết lộ trình" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ roadmapId: string }>;
  searchParams: Promise<{
    day?: string | string[];
    tab?: string | string[];
    open?: string | string[];
  }>;
}) {
  // RM-03 and RM-14 are Traveler-only operations.
  const user = await requireUser(["TRAVELER"]);
  const roadmapId = parseRoadmapId((await params).roadmapId);
  if (roadmapId === null) notFound();
  const { day, tab, open } = await searchParams;
  // Every day starts folded; ?open= reopens the days unfolded before a reload, and an older link
  // with only ?day= opens that day.
  const openDays = parseOpenParam(open);
  if (!openDays.length && day !== undefined) openDays.push(parseDayParam(day));
  // Picked on the server for each request, so every visit may show another banner and the
  // client renders the same one (no hydration mismatch).
  const heroImage = pickRoadmapHeroImage();
  return (
    <div className="roadmap-detail-page">
      <RoadmapDetailPage
        roadmapId={roadmapId}
        heroImage={heroImage}
        userId={user.id}
        userName={user.displayName}
        userAvatar={user.avatarUrl}
        initialDay={parseDayParam(day)}
        initialOpenDays={openDays}
        initialTab={parseTabParam(tab)}
      />
    </div>
  );
}
