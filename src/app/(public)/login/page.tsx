import { redirect } from "next/navigation";
import Brand from "@/components/brand";
import LoginForm from "@/features/auth/login-form";
import { getSession, readAuth } from "@/features/auth/server";
import { HOME_BY_ROLE } from "@/features/auth/roles";
import { Alert, Card } from "@/shared/ui";
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
        <Card className="login-card">
          {reason && known.includes(reason) && (
            <Alert>
              {getErrorMessage(
                new ApiError(401, reason, "Vui lòng đăng nhập lại."),
              )}
            </Alert>
          )}
          <LoginForm />
        </Card>
      </div>
    </main>
  );
}
