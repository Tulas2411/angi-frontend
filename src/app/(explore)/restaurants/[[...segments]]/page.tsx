import { Suspense } from "react";
import { PageRouter } from "@/features/platform/page-router";
import { Skeleton } from "@/components/ui/primitives";
export default async function Page({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments = [] } = await params;
  return (
    <Suspense fallback={<Skeleton />}>
      <PageRouter role="GUEST" segments={["restaurants", ...segments]} />
    </Suspense>
  );
}
