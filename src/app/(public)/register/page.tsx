import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-shell";
import RegisterForm from "@/features/auth/register-form";

export const metadata: Metadata = { title: "Đăng ký" };

export default function Page() {
  // /register stays reachable with a session so a user can create another account.
  return (
    <AuthShell
      eyebrow="Tham gia ANGI"
      title="Tạo tài khoản"
      description="Khám phá món ngon hợp gu và đồng hành cùng ANGI."
    >
      <RegisterForm />
    </AuthShell>
  );
}
