import type { ReactNode } from "react";
import PublicShell from "@/components/public-shell";
import { readSessionUser } from "@/features/auth/server";

/** Public discovery pages: guests browse freely, a signed-in role gets its account menu. */
export default async function SiteGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <PublicShell user={await readSessionUser()}>{children}</PublicShell>;
}
