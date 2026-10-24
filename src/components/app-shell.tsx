import type { ReactNode } from "react";
import type { AuthUserDto, RoleCode } from "@/features/auth/types";
import { AccountMenu } from "@/components/site/account-menu";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SiteNav, type SiteNavItem } from "@/components/site/site-nav";
import { ownerRoutes } from "@/features/owner/routes";
import { roadmapRoutes } from "@/features/roadmaps/routes";
import { HOME_BY_ROLE } from "@/features/auth/roles";

/** Only roles with a workspace backed by the real API have a primary navigation. */
const navigation: Partial<
  Record<RoleCode, { label: string; items: readonly SiteNavItem[] }>
> = {
  RESTAURANT_OWNER: {
    label: "Điều hướng nhà hàng",
    items: [
      { href: ownerRoutes.overview, label: "Tổng quan", match: "exact" },
      { href: ownerRoutes.profile, label: "Nhà hàng", match: "prefix" },
      { href: ownerRoutes.verification, label: "Xác minh", match: "prefix" },
      { href: ownerRoutes.menu, label: "Thực đơn", match: "prefix" },
    ],
  },
  TRAVELER: {
    label: "Điều hướng lộ trình",
    items: [
      { href: roadmapRoutes.list, label: "Lộ trình của tôi", match: "exact" },
      { href: roadmapRoutes.plan, label: "Lập lộ trình", match: "exact" },
    ],
  },
};

export default function AppShell({
  user,
  children,
}: {
  user: AuthUserDto;
  children: ReactNode;
}) {
  const menu = navigation[user.role];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <SiteHeader
        brandHref={HOME_BY_ROLE[user.role]}
        nav={menu && <SiteNav items={menu.items} label={menu.label} />}
      >
        <AccountMenu user={user} />
      </SiteHeader>
      <main id="main-content" className="page app-main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter
        tagline="Không gian dành cho thành viên ANGI."
        links={[{ href: "/", label: "Trang chủ ANGI" }]}
      />
    </div>
  );
}
