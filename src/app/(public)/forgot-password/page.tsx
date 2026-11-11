import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/password-recovery";

export const metadata: Metadata = { title: "Quên mật khẩu" };

export default function Page() {
  return (
    <AuthShell
      eyebrow="Tài khoản"
      title="Quên mật khẩu"
      description="Nhập email tài khoản để nhận liên kết đặt lại mật khẩu."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
