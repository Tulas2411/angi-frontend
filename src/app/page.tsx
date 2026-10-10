import { Suspense } from "react";
import { WorkspaceShell } from "@/components/layout/workspace";
import { PageRouter } from "@/features/platform/page-router";
import { Skeleton } from "@/components/ui/primitives";
export default function HomePage() {
  return (
    <WorkspaceShell
      user={null}
      base=""
      mode={process.env.NEXT_PUBLIC_DATA_MODE === "demo" ? "demo" : "live"}
    >
      <Suspense fallback={<Skeleton />}>
        <PageRouter role="GUEST" />
      </Suspense>
    </WorkspaceShell>
  );
}
