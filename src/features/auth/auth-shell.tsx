import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/site-header";

/** Shared frame for every authentication page: site header and a centered card. */
export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <SiteHeader>
        <Link href="/" className="text-link" prefetch={false}>
          Về trang chủ
        </Link>
      </SiteHeader>
      <main id="main-content" className="auth-main" tabIndex={-1}>
        <section className="auth-card">
          <div className="auth-heading">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {children}
        </section>
        {footer && <p className="auth-footer">{footer}</p>}
      </main>
    </div>
  );
}
