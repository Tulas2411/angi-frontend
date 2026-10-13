import { Suspense } from "react";
import { PageRouter } from "@/features/platform/page-router";
import { WorkspaceScope } from "@/components/layout/workspace";
import { Skeleton } from "@/components/ui/primitives";
import { requireUser } from "@/features/auth/server";
export default async function Page() {
  await requireUser(["TRAVELER"]);
  return (
    <WorkspaceScope base="/discovery">
      <Suspense fallback={<Skeleton />}>
        <PageRouter role="TRAVELER" />
      </Suspense>
    </WorkspaceScope>
  );
}
