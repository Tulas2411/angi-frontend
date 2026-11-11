import type { ReactNode } from "react";

/** Scopes the earlier workspace styles (`legacy-workspace.css`) to the screens that still use them. */
export function LegacyScope({ children }: { children: ReactNode }) {
  return <div className="legacy-ui">{children}</div>;
}
