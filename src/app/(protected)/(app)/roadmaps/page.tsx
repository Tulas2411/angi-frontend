import type { Metadata } from "next";
import { requireUser } from "@/features/auth/server";
import { MyRoadmapsPage } from "@/features/roadmaps/my-roadmaps-page";
import { parseRoadmapPage } from "@/features/roadmaps/roadmap-list-rules";

export const metadata: Metadata = { title: "Lộ trình của tôi" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; new?: string | string[] }>;
}) {
  // RM-02 is a Traveler-only operation.
  const user = await requireUser(["TRAVELER"]);
  const { page, new: planning } = await searchParams;
  return (
    <MyRoadmapsPage
      page={parseRoadmapPage(page)}
      owner={user.displayName}
      // `?new=1` (header, footer, home page) opens "Lập lộ trình mới" over the list.
      planning={planning === "1"}
    />
  );
}
