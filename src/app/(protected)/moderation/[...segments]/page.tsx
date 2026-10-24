import { Suspense } from "react";
import { PageRouter } from "@/features/platform/page-router";
import { WorkspaceScope } from "@/components/layout/workspace";
import { Skeleton } from "@/components/ui/primitives";
import { requireUser } from "@/features/auth/server";
export default async function Page({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  await requireUser(["MOD", "ADMIN"]);
  const { segments } = await params;
  return (
    <WorkspaceScope base="/moderation">
      <Suspense fallback={<Skeleton />}>
        <PageRouter role="MOD" segments={segments} />
      </Suspense>
    </WorkspaceScope>
  );
}
