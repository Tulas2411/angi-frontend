import type { ReactNode } from "react";
import AppShell from "@/components/app-shell";
import { requireUser } from "@/features/auth/server";
export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppShell user={await requireUser()}>{children}</AppShell>;
}
