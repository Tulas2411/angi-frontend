import type { Metadata } from "next";
import { requireUser } from "@/features/auth/server";
import { RestaurantMenuPage } from "@/features/owner/restaurant-menu-page";

export const metadata: Metadata = { title: "Thực đơn" };

export default async function Page() {
  await requireUser(["RESTAURANT_OWNER"]);
  return <RestaurantMenuPage />;
}
