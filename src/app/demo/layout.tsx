import type { ReactNode } from "react";
import { LegacyScope } from "@/components/legacy-scope";

export default function LegacyRouteLayout({ children }: { children: ReactNode }) {
  return <LegacyScope>{children}</LegacyScope>;
}
