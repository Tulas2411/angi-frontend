"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SiteNavItem {
  href: string;
  label: string;
  /** `exact` matches only the same path; `prefix` also matches nested paths. */
  match?: "exact" | "prefix";
}

/** Primary navigation of the protected workspace. The current page is exposed through aria-current. */
export function SiteNav({
  items,
  label,
}: {
  items: readonly SiteNavItem[];
  label: string;
}) {
  const path = usePathname();
  return (
    <nav className="site-nav" aria-label={label}>
      {items.map((item) => {
        const active =
          item.match === "prefix"
            ? path === item.href || path.startsWith(`${item.href}/`)
            : path === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
