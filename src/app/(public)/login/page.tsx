import { redirect } from "next/navigation";
import Brand from "@/components/brand";
import LoginForm from "@/features/auth/login-form";
import { getSession, readAuth } from "@/features/auth/server";
import { Alert, Card } from "@/shared/ui";
import { ApiError, getErrorMessage } from "@/shared/api/error";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; next?: string }>;
}) {
  // Cho phép mở /login bất kể đã đăng nhập hay chưa (hỗ trợ test UI form).
  // Chỉ tự chuyển sang homepage khi user gõ /login mà có query ?reason=UNAUTHORIZED.
  const { reason, next } = await searchParams;
  const auth = readAuth(await getSession());
  if (auth && reason === "UNAUTHORIZED" && !next) {
    redirect("/demo/traveler");
  }
  const known = [
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
        <Card className="login-card">
          {reason && known.includes(reason) && (
            <Alert>
              {getErrorMessage(
                new ApiError(401, reason, "Vui lòng đăng nhập lại."),
              )}
            </Alert>
          )}
          {auth && (
            <Alert>
              Bạn đang đăng nhập với tài khoản <b>{auth.user.email}</b> (
              {auth.user.role}). Bạn có thể đăng nhập lại để chuyển tài khoản.
            </Alert>
          )}
          <LoginForm />
        </Card>
      </div>
    </main>
  );
}
