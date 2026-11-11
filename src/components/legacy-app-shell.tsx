import type { ReactNode } from "react";
import type { AuthUserDto } from "@/features/auth/types";
import { HOME_BY_ROLE } from "@/features/auth/roles";
import { WorkspaceShell } from "@/components/layout/workspace";

/**
 * Shell of the earlier workspace screens (moderation, administration and the remaining owner
 * pages). Those screens keep their own header, navigation, notifications and styles.
 */
export default function LegacyAppShell({
  user,
  children,
}: {
  user: AuthUserDto;
  children: ReactNode;
}) {
  return (
    <div className="legacy-ui">
      <WorkspaceShell
        user={user}
        base={HOME_BY_ROLE[user.role]}
        mode={process.env.NEXT_PUBLIC_DATA_MODE === "demo" ? "demo" : "live"}
      >
        {children}
      </WorkspaceShell>
    </div>
  );
}
