import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readSessionUser } from "@/features/auth/server";
import { parseEntityId } from "@/features/explore/explore-rules";
import {
  RestaurantDetailPage,
  type Viewer,
} from "@/features/explore/restaurant-detail-page";

export const metadata: Metadata = { title: "Chi tiết quán ăn" };

export default async function Page({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const restaurantId = parseEntityId((await params).restaurantId);
  if (restaurantId === null) notFound();
  const user = await readSessionUser();
  // REV-01 and REP-01 are Traveler-only; other roles read the page without the buttons.
  const viewer: Viewer = !user
    ? "GUEST"
    : user.role === "TRAVELER"
      ? "TRAVELER"
      : "OTHER";
  return <RestaurantDetailPage restaurantId={restaurantId} viewer={viewer} />;
}
