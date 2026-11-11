import type { Metadata } from "next";
import { requireUser } from "@/features/auth/server";
import { RollDishPage } from "@/features/roll/roll-dish-page";

export const metadata: Metadata = { title: "Hôm nay ăn gì?" };

export default async function Page() {
  // DISH-03 is a Traveler-only operation.
  await requireUser(["TRAVELER"]);
  return <RollDishPage />;
}
