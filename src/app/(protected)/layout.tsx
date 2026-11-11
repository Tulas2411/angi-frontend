import type { ReactNode } from "react";

/** Each route group below authenticates and supplies its own shell. */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return children;
}
