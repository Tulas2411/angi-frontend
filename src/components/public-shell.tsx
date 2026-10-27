import type { ReactNode } from "react";
import Link from "next/link";
import type { AuthUserDto } from "@/features/auth/types";
import { HOME_BY_ROLE } from "@/features/auth/roles";
import { AccountMenu } from "@/components/site/account-menu";
import { navigationFor } from "@/components/site/navigation";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SiteNav } from "@/components/site/site-nav";

/**
 * Shell of the public discovery pages (dishes and restaurants). It reads no redirect: a guest sees
 * the same pages with login and register buttons; a signed-in role gets the account menu.
 */
export default function PublicShell({
  user,
  children,
}: {
  user: AuthUserDto | null;
  children: ReactNode;
}) {
  const menu = navigationFor(user?.role ?? null);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <SiteHeader
        brandHref={user ? HOME_BY_ROLE[user.role] : "/"}
        nav={menu && <SiteNav items={menu.items} label={menu.label} />}
      >
        {user ? (
          <AccountMenu user={user} />
        ) : (
          <>
            <Link
              href="/login"
              prefetch={false}
              className="button button-secondary"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              prefetch={false}
              className="button button-primary site-join"
            >
              Tham gia ANGI <span aria-hidden>↗</span>
            </Link>
          </>
        )}
      </SiteHeader>
      <main id="main-content" className="page app-main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter
        tagline="Ăn ngon. Đi xa. Nhớ lâu."
        links={[{ href: "/", label: "Trang chủ ANGI" }]}
      />
    </div>
  );
}
