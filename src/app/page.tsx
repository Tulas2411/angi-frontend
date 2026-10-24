import { Suspense } from "react";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/workspace";
import { PageRouter } from "@/features/platform/page-router";
import { Skeleton } from "@/components/ui/primitives";
import { getSession, readAuth } from "@/features/auth/server";
import { HOME_BY_ROLE } from "@/features/auth/roles";

export default async function HomePage() {
  const auth = readAuth(await getSession());
  if (!auth) {
    // Bắt buộc đăng nhập đúng tài khoản BE mới vào được homepage.
    redirect("/login?reason=UNAUTHORIZED");
  }
  // Đã đăng nhập: render homepage theo role (mặc định traveler).
  const home = HOME_BY_ROLE[auth.user.role] ?? "/demo/traveler";
  if (home !== "/") redirect(home);

  return (
    <WorkspaceShell
      user={auth.user}
      base=""
      mode={process.env.NEXT_PUBLIC_DATA_MODE === "demo" ? "demo" : "live"}
    >
      <Suspense fallback={<Skeleton />}>
        <PageRouter role={auth.user.role} />
      </Suspense>
    </WorkspaceShell>
  );
}
