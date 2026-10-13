import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/layout/workspace";
export default function ExploreLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceShell
      user={null}
      base=""
      mode={process.env.NEXT_PUBLIC_DATA_MODE === "demo" ? "demo" : "live"}
    >
      {children}
    </WorkspaceShell>
  );
}
