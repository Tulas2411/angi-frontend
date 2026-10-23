import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/shared/ui";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { AuthShell } from "@/features/auth/auth-shell";
import LoginForm from "@/features/auth/login-form";
import { HOME_BY_ROLE, LABEL_BY_ROLE } from "@/features/auth/roles";
import { getSession, readAuth } from "@/features/auth/server";

export const metadata: Metadata = { title: "Đăng nhập" };

const sessionReasons = [
  "UNAUTHORIZED",
  "REFRESH_TOKEN_INVALID",
  "ACCOUNT_BANNED",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_DEACTIVATED",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  // /login stays reachable with a session so a user can switch accounts.
  const auth = readAuth(await getSession());
  return (
    <AuthShell
      eyebrow="Chào mừng trở lại"
      title="Đăng nhập vào ANGI"
      description="Tiếp tục hành trình ăn ngon của bạn."
      footer={
        <>
          Bạn chưa có tài khoản?{" "}
          <Link href="/register" prefetch={false} className="text-link">
            Đăng ký ngay
          </Link>
        </>
      }
    >
      {reason && sessionReasons.includes(reason) && (
        <Alert>
          {getErrorMessage(
            new ApiError(401, reason, "Vui lòng đăng nhập lại."),
          )}
        </Alert>
      )}
      {auth && (
        <Alert tone="info">
          Bạn đang đăng nhập với <b>{auth.user.email}</b> (
          {LABEL_BY_ROLE[auth.user.role]}).{" "}
          <Link href={HOME_BY_ROLE[auth.user.role]} className="text-link">
            Tiếp tục với tài khoản này
          </Link>{" "}
          hoặc đăng nhập lại để chuyển tài khoản.
        </Alert>
      )}
      <LoginForm />
    </AuthShell>
  );
}
