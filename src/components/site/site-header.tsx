import type { ReactNode } from "react";
import Brand from "@/components/brand";

/**
 * Sticky header shared by the homepage, authentication pages and the signed-in
 * workspace. `nav` is optional; `children` are the right-hand actions.
 */
export function SiteHeader({
  nav,
  children,
  brandHref = "/",
}: {
  nav?: ReactNode;
  children?: ReactNode;
  brandHref?: string;
}) {
  return (
    <div className="site-header-bar">
      <header className="site-header">
        <Brand href={brandHref} />
        {nav}
        {children && <div className="site-actions">{children}</div>}
      </header>
    </div>
  );
}
