import Brand from "@/components/brand";
import Link from "next/link";
import { Alert, Card } from "@/shared/ui";

export const metadata = {
  title: "Xác minh thành công",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <main className="container auth-page">
      <Brand />
      <div className="auth-card stack">
        <Card className="stack">
          <Alert tone="success">
            Xác minh email thành công! Tài khoản của bạn đã được kích hoạt.
          </Alert>
          {email && (
            <p className="helper">
              Email đã xác minh: <strong>{email}</strong>
            </p>
          )}
          <div className="auth-links-vertical">
            <Link href="/login" className="button button-primary auth-link-button">
              Đăng nhập
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
