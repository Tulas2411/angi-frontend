import type { ReactNode } from "react";
import type { AuthUserDto } from "@/features/auth/types";
import { HOME_BY_ROLE } from "@/features/auth/roles";
import { WorkspaceShell } from "@/components/layout/workspace";
export default function AppShell({
  user,
  children,
}: {
  user: AuthUserDto;
  children: ReactNode;
}) {
  return (
    <WorkspaceShell
      user={user}
      base={HOME_BY_ROLE[user.role]}
      mode={process.env.NEXT_PUBLIC_DATA_MODE === "demo" ? "demo" : "live"}
    >
      {children}
    </WorkspaceShell>
  );
}
