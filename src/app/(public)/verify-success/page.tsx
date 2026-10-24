import type { Metadata } from "next";
import { Alert } from "@/shared/ui";
import { ActionLink } from "@/components/ui/primitives";
import { AuthShell } from "@/features/auth/auth-shell";

export const metadata: Metadata = { title: "Xác minh thành công" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <AuthShell eyebrow="Tài khoản" title="Xác minh thành công">
      <div className="stack">
        <Alert tone="success">
          Email đã được xác minh và tài khoản của bạn đã được kích hoạt.
        </Alert>
        {email && (
          <p className="helper">
            Email đã xác minh: <strong>{email}</strong>
          </p>
        )}
        <ActionLink href="/login">Đăng nhập</ActionLink>
      </div>
    </AuthShell>
  );
}
