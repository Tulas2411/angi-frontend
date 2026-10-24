import { Suspense } from "react";
import { PageRouter } from "@/features/platform/page-router";
import { WorkspaceScope } from "@/components/layout/workspace";
import { Skeleton } from "@/components/ui/primitives";
import { requireUser } from "@/features/auth/server";
export default async function Page() {
  await requireUser(["ADMIN"]);
  return (
    <WorkspaceScope base="/administration">
      <Suspense fallback={<Skeleton />}>
        <PageRouter role="ADMIN" />
      </Suspense>
    </WorkspaceScope>
  );
}
