import type { ReactNode } from "react";
import type { AuthUserDto } from "@/features/auth/types";
import { AccountMenu } from "@/components/site/account-menu";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { navigationFor } from "@/components/site/navigation";
import { SiteNav } from "@/components/site/site-nav";
import { HOME_BY_ROLE } from "@/features/auth/roles";

export default function AppShell({
  user,
  children,
}: {
  user: AuthUserDto;
  children: ReactNode;
}) {
  const menu = navigationFor(user.role);
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
