import type { Metadata } from "next";
import { requireUser } from "@/features/auth/server";
import { MyRoadmapsPage } from "@/features/roadmaps/my-roadmaps-page";
import { parseRoadmapPage } from "@/features/roadmaps/roadmap-list-rules";

export const metadata: Metadata = { title: "Lộ trình của tôi" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  // RM-02 is a Traveler-only operation.
  await requireUser(["TRAVELER"]);
  const { page } = await searchParams;
  return <MyRoadmapsPage page={parseRoadmapPage(page)} />;
}
