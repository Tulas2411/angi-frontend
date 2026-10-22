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
    // Đã đăng nhập thì render nhánh TRAVELER (đầy đủ chức năng),
    // khách thì render nhánh GUEST — KHÔNG chuyển hướng sang /login.
    { role } = await readPublicSession();
  return (
    <Suspense fallback={<Skeleton />}>
      <PageRouter role={role} segments={["dishes", ...segments]} />
    </Suspense>
  );
}
