import type { Metadata } from "next";
import { requireUser } from "@/features/auth/server";
import { RollPage } from "@/features/roll/roll-page";

export const metadata: Metadata = { title: "Hôm nay ăn gì?" };

export default async function Page() {
  // DISH-03 is a Traveler-only operation.
  await requireUser(["TRAVELER"]);
  return <RollPage />;
}
