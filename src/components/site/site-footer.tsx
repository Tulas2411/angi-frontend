import Link from "next/link";
import type { ReactNode } from "react";
import Brand from "@/components/brand";

export interface SiteFooterLink {
  href: string;
  label: ReactNode;
  /** Use a plain anchor for in-page targets. */
  anchor?: boolean;
}

export function SiteFooter({
  links = [],
  tagline = "Ăn ngon. Đi xa. Nhớ lâu.",
}: {
  links?: readonly SiteFooterLink[];
  tagline?: string;
}) {
  return (
    <footer className="site-footer">
      <div>
        <Brand href="/" />
        <p>{tagline}</p>
      </div>
      {links.length > 0 && (
        <nav aria-label="Điều hướng cuối trang">
          {links.map((link) =>
            link.anchor ? (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} prefetch={false}>
                {link.label}
              </Link>
            ),
          )}
        </nav>
      )}
      <span>ANGI · Hương vị Việt, theo cách của bạn.</span>
    </footer>
  );
}
