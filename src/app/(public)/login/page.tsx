import { redirect } from "next/navigation";
import Brand from "@/components/brand";
import LoginForm from "@/features/auth/login-form";
import { getSession, readAuth } from "@/features/auth/server";
import { HOME_BY_ROLE } from "@/features/auth/roles";
import { Alert, Card } from "@/shared/ui";
import { ActionLink } from "@/components/ui/primitives";
import { ApiError, getErrorMessage } from "@/shared/api/error";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const auth = readAuth(await getSession());
  if (auth) redirect(HOME_BY_ROLE[auth.user.role]);
  const { reason } = await searchParams,
    known = [
      "UNAUTHORIZED",
      "REFRESH_TOKEN_INVALID",
      "ACCOUNT_BANNED",
      "ACCOUNT_SUSPENDED",
      "ACCOUNT_DEACTIVATED",
    ];
  return (
    <main className="container auth-page">
      <Brand />
      <div className="auth-card stack">
        <h1>Đăng nhập</h1>
        <p>Tiếp tục hành trình khám phá ẩm thực của bạn.</p>
        <Card>
          {reason && known.includes(reason) && (
            <Alert>
              {getErrorMessage(
                new ApiError(401, reason, "Vui lòng đăng nhập lại."),
              )}
            </Alert>
          )}
          <LoginForm />
          <div className="between auth-links">
            <ActionLink href="/forgot-password" secondary>
              Quên mật khẩu?
            </ActionLink>
            <ActionLink href="/register" secondary>
              Đăng ký
            </ActionLink>
          </div>
        </Card>
        <ActionLink href="/" secondary>
          ← Về trang chủ
        </ActionLink>
      </div>
    </main>
  );
}
