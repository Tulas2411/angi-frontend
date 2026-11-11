import type { Metadata } from "next";
import { requireUser } from "@/features/auth/server";
import { AccountPage } from "@/features/account/account-page";

export const metadata: Metadata = { title: "Tài khoản" };

export default async function Page() {
  // Every signed-in role may manage its own account (ME-01..03).
  await requireUser();
  return <AccountPage />;
}
