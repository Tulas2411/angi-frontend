import type { Metadata } from "next";
import { requireUser } from "@/features/auth/server";
import { RestaurantBusinessHoursPage } from "@/features/owner/restaurant-business-hours-page";
import { RestaurantOperatingStatusPage } from "@/features/owner/restaurant-operating-status-page";
import { RestaurantProfilePage } from "@/features/owner/restaurant-profile-page";

export const metadata: Metadata = { title: "Nhà hàng của tôi" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireUser(["RESTAURANT_OWNER"]);
  const { tab } = await searchParams;
  if (tab === "hours") return <RestaurantBusinessHoursPage />;
  if (tab === "status") return <RestaurantOperatingStatusPage />;
  return <RestaurantProfilePage initialTab={tab ?? "information"} />;
}
