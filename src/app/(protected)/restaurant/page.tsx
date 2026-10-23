import type { Metadata } from "next";
import { requireUser } from "@/features/auth/server";
import { OwnerOverviewPage } from "@/features/owner/owner-overview-page";

export const metadata: Metadata = { title: "Tổng quan nhà hàng" };

export default async function Page() {
  await requireUser(["RESTAURANT_OWNER"]);
  return <OwnerOverviewPage />;
}
