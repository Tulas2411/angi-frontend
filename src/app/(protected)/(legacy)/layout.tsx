import type { ReactNode } from "react";
import LegacyAppShell from "@/components/legacy-app-shell";
import { requireUser } from "@/features/auth/server";

export default async function LegacyGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <LegacyAppShell user={await requireUser()}>{children}</LegacyAppShell>;
}
