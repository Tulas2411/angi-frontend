import { Suspense } from "react";
import { PageRouter } from "@/features/platform/page-router";
import { Skeleton } from "@/components/ui/primitives";
import { readPublicSession } from "@/features/auth/server";
export default async function Page({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments = [] } = await params,
    { role } = await readPublicSession();
  return (
    <Suspense fallback={<Skeleton />}>
      <PageRouter role={role} segments={["restaurants", ...segments]} />
    </Suspense>
  );
}
