import { ActionLink } from "@/components/ui/primitives";
import { SiteHeader } from "@/components/site/site-header";

/** Routes that no longer exist (demo, discovery, moderation, administration…) end here. */
export default function NotFound() {
  return (
    <div className="auth-shell">
      <SiteHeader />
      <main id="main-content" className="auth-main" tabIndex={-1}>
        <section className="auth-card stack text-center">
          <div className="auth-heading">
            <p className="eyebrow">404</p>
            <h1>Trang này chưa có</h1>
            <p>Đường dẫn bạn mở không tồn tại hoặc đã được gỡ bỏ.</p>
          </div>
          <ActionLink href="/">Về trang chủ</ActionLink>
        </section>
      </main>
    </div>
  );
}
