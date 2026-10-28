import type { Metadata } from "next";
import { requireUser } from "@/features/auth/server";
import { RestaurantReviewsPage } from "@/features/owner/restaurant-reviews-page";

export const metadata: Metadata = { title: "Đánh giá thực khách" };

export default async function Page() {
  await requireUser(["RESTAURANT_OWNER"]);
  return <RestaurantReviewsPage />;
}
