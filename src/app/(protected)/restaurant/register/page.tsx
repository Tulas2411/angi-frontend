import type { Metadata } from "next";
import { requireUser } from "@/features/auth/server";
import { RestaurantRegistrationPage } from "@/features/owner/restaurant-registration-page";

export const metadata: Metadata = { title: "Đăng ký nhà hàng" };

export default async function Page() {
  await requireUser(["RESTAURANT_OWNER"]);
  return <RestaurantRegistrationPage />;
}
