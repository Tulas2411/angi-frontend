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
  searchParams,
}: {
  params: Promise<{ restaurantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const restaurantId = parseEntityId((await params).restaurantId);
  if (restaurantId === null) notFound();
  // `?tab=reviews&review=9`: opened from a REVIEW_REPLIED notification.
  const query = await searchParams;
  const tab = typeof query.tab === "string" ? query.tab : undefined;
  const review =
    typeof query.review === "string" ? parseEntityId(query.review) : null;
  const user = await readSessionUser();
  // REV-01 and REP-01 are Traveler-only; other roles read the page without the buttons.
  const viewer: Viewer = !user
    ? "GUEST"
    : user.role === "TRAVELER"
      ? "TRAVELER"
      : "OTHER";
  return (
    <RestaurantDetailPage
      key={`${restaurantId}:${tab ?? ""}:${review ?? ""}`}
      restaurantId={restaurantId}
      viewer={viewer}
      initialTab={review ? "reviews" : tab}
      focusReviewId={review}
    />
  );
}
