import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/auth/auth-shell";
import { ResetPasswordForm } from "@/features/auth/password-recovery";

export const metadata: Metadata = { title: "Đặt lại mật khẩu" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  // The emailed link always carries the token; without it there is nothing to reset.
  if (!token) redirect("/forgot-password");
  return (
    <AuthShell
      eyebrow="Tài khoản"
      title="Đặt lại mật khẩu"
      description="Chọn mật khẩu mới cho tài khoản ANGI của bạn."
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
