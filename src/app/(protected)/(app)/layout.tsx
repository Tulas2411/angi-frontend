import type { ReactNode } from "react";
import AppShell from "@/components/app-shell";
import { requireUser } from "@/features/auth/server";

/** Backend-integrated screens: account and the Restaurant Owner workspace. */
export default async function AppGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppShell user={await requireUser()}>{children}</AppShell>;
}
