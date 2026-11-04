import Link from "next/link";
import type { ReactNode } from "react";
import Brand from "@/components/brand";
import type { RoleCode } from "@/features/auth/types";
import { HOME_BY_ROLE } from "@/features/auth/roles";
import { roadmapRoutes } from "@/features/roadmaps/routes";
import { discoveryNav, navigationFor } from "./navigation";
import "./site-footer.css";

export interface SiteFooterLink {
  href: string;
  label: ReactNode;
  /** Use a plain anchor for in-page targets. */
  anchor?: boolean;
}

export function SiteFooter({
  links = [],
  tagline = "Ăn ngon. Đi xa. Nhớ lâu.",
  role = null,
}: {
  links?: readonly SiteFooterLink[];
  tagline?: string;
  role?: RoleCode | null;
}) {
  const traveler = role === null || role === "TRAVELER";
  const owner = role === "RESTAURANT_OWNER";
  const journeyLinks: readonly SiteFooterLink[] = traveler
    ? [
        { href: roadmapRoutes.plan, label: "Lập lộ trình mới" },
        { href: roadmapRoutes.list, label: "Lộ trình của tôi" },
        { href: "/roll", label: "Hôm nay ăn gì?" },
      ]
    : (navigationFor(role)?.items ?? [
        { href: HOME_BY_ROLE[role], label: "Không gian làm việc" },
      ]);
  const used = new Set([
    ...discoveryNav.map(({ href }) => href),
    ...journeyLinks.map(({ href }) => href),
  ]);
  const moreLinks = [
    { href: "/", label: "Trang chủ ANGI" },
    ...links,
    ...(role
      ? [{ href: "/account", label: "Tài khoản của tôi" }]
      : [
          { href: "/register", label: "Tham gia ANGI" },
          { href: "/login", label: "Đăng nhập" },
        ]),
  ].filter(({ href }) => {
    if (used.has(href)) return false;
    used.add(href);
    return true;
  });
  const groups = [
    { title: "Khám phá", links: discoveryNav },
    {
      title: traveler
        ? "Hành trình của bạn"
        : owner
          ? "Chủ nhà hàng"
          : "Thành viên",
      links: journeyLinks,
    },
    { title: "Cùng ANGI", links: moreLinks },
  ];
  return (
    <footer className="site-footer">
      <div className="site-footer-directory">
        <div className="site-footer-about">
          <Brand href="/" />
          <p>Hương vị Việt, theo cách của bạn.</p>
          <p>
            Khám phá món ngon, tìm quán hợp gu và ghép những bữa ăn thành chuyến
            đi của riêng mình.
          </p>
          <span className="site-footer-signature">
            <span aria-hidden>✳</span> {tagline}
          </span>
        </div>
        <nav
          className="site-footer-navigation"
          aria-label="Điều hướng cuối trang"
        >
          {groups.map((group) => (
            <div className="site-footer-link-group" key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.links.map((link: SiteFooterLink) => (
                  <li key={link.href}>
                    {link.anchor ? (
                      <a href={link.href}>{link.label}</a>
                    ) : (
                      <Link href={link.href} prefetch={false}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="site-footer-wordmark" aria-hidden="true">
        <span>ANGI</span>
        <span>
          Ăn ngon.
          <br />
          Đi xa. Nhớ lâu.
        </span>
      </div>
      <div className="site-footer-bottom">
        <small>
          © {new Date().getFullYear()} ANGI. Một hành trình đầy hương vị.
        </small>
        <span>
          Được tạo nên từ tình yêu ẩm thực Việt <span aria-hidden>♥</span>
        </span>
        <a href="#">
          Về đầu trang <span aria-hidden>↑</span>
        </a>
      </div>
    </footer>
  );
}
