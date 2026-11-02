import Link from "next/link";
import Image from "next/image";
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
      <div className="site-footer-invitation">
        <div className="site-footer-invitation-copy">
          <p className="site-footer-eyebrow">
            <span aria-hidden /> Một chút cảm hứng, một chuyến đi ngon
          </p>
          <h2>
            {owner ? (
              <>
                Hương vị của bạn.
                <br />
                <em>Thêm người biết đến.</em>
              </>
            ) : (
              <>
                Đi để nhớ.
                <br />
                <em>Ăn để thương.</em>
              </>
            )}
          </h2>
          <p>
            {owner
              ? "Chăm chút gian bếp của bạn trên ANGI, từ câu chuyện quán đến từng món trong thực đơn."
              : "Từ một món ăn hợp gu đến cả hành trình khám phá. Cùng ANGI tìm hương vị khiến bạn muốn quay lại."}
          </p>
          <Link
            href={traveler ? roadmapRoutes.plan : HOME_BY_ROLE[role]}
            prefetch={false}
            className="site-footer-action"
          >
            {traveler
              ? "Lên lịch chuyến đi ngon"
              : owner
                ? "Quản lý nhà hàng"
                : "Về không gian của bạn"}
            <span aria-hidden>↗</span>
          </Link>
        </div>
        <div className="site-footer-art" aria-hidden="true">
          <span className="site-footer-orbit" />
          <span className="site-footer-art-note">
            Hẹn bạn ở bữa ngon tiếp theo.
          </span>
          <div className="site-footer-photo site-footer-photo-main">
            <Image
              src="/assets/figma/roll-2.png"
              alt=""
              fill
              sizes="(max-width: 700px) 200px, 280px"
            />
          </div>
          <div className="site-footer-photo site-footer-photo-small">
            <Image
              src="/assets/figma/roll-1.png"
              alt=""
              fill
              sizes="(max-width: 700px) 110px, 145px"
            />
          </div>
          <span className="site-footer-art-stamp">
            Ăn đúng gu <span>✳</span> Đi thật đã
          </span>
        </div>
      </div>
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
