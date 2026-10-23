import type { Metadata } from "next";
import { requireUser } from "@/features/auth/server";
import { RestaurantVerificationPage } from "@/features/owner/restaurant-verification-page";

export const metadata: Metadata = { title: "Xác minh nhà hàng" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireUser(["RESTAURANT_OWNER"]);
  const { tab } = await searchParams;
  return <RestaurantVerificationPage initialTab={tab} />;
}
