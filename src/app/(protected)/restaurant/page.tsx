import { Suspense } from "react";
import { PageRouter } from "@/features/platform/page-router";
import { WorkspaceScope } from "@/components/layout/workspace";
import { Skeleton } from "@/components/ui/primitives";
import { requireUser } from "@/features/auth/server";
export default async function Page() {
  await requireUser(["RESTAURANT_OWNER"]);
  return (
    <WorkspaceScope base="/restaurant">
      <Suspense fallback={<Skeleton />}>
        <PageRouter role="RESTAURANT_OWNER" />
      </Suspense>
    </WorkspaceScope>
  );
}
