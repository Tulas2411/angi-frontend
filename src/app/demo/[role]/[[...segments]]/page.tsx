import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageRouter } from "@/features/platform/page-router";
import { demoRoles } from "@/features/platform/demo-role";
import { Skeleton } from "@/components/ui/primitives";
export default async function DemoPage({
  params,
}: {
  params: Promise<{ role: string; segments?: string[] }>;
}) {
  const { role, segments } = await params,
    code = demoRoles[role];
  if (!code) notFound();
  return (
    <Suspense fallback={<Skeleton />}>
      <PageRouter role={code} segments={segments} />
    </Suspense>
  );
}
