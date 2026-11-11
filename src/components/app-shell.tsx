import type { ReactNode } from "react";
import type { AuthUserDto } from "@/features/auth/types";
import { AccountMenu } from "@/components/site/account-menu";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { navigationFor } from "@/components/site/navigation";
import { HeaderNav, HeaderRoadmapShare } from "@/components/site/header-nav";
import { HOME_BY_ROLE } from "@/features/auth/roles";
import { OwnerDashboard } from "@/components/layout/workspace";

export default function AppShell({
  user,
  children,
}: {
  user: AuthUserDto;
  children: ReactNode;
}) {
  // A Restaurant Owner works in the dashboard shell, like the Mod and Admin workspaces.
  if (user.role === "RESTAURANT_OWNER")
    return <OwnerDashboard user={user}>{children}</OwnerDashboard>;
  const menu = navigationFor(user.role);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <SiteHeader
        brandHref={HOME_BY_ROLE[user.role]}
        nav={menu && <HeaderNav items={menu.items} label={menu.label} />}
      >
        <HeaderRoadmapShare />
        <AccountMenu user={user} />
      </SiteHeader>
      <main id="main-content" className="page app-main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter
        role={user.role}
        tagline="Không gian dành cho thành viên ANGI."
        links={[{ href: "/", label: "Trang chủ ANGI" }]}
      />
    </div>
  );
}
