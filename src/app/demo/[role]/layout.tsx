import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/layout/workspace";
import { demoUsers } from "@/mocks/fixtures";
import { demoRoles } from "@/features/platform/demo-role";
export default async function DemoLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ role: string }>;
}) {
  const { role } = await params,
    code = demoRoles[role];
  if (!code || process.env.NEXT_PUBLIC_ENABLE_DEMO === "false") notFound();
  return (
    <WorkspaceShell
      user={code === "GUEST" ? null : demoUsers[code]}
      base={`/demo/${role}`}
      mode="demo"
      demo
    >
      {children}
    </WorkspaceShell>
  );
}
