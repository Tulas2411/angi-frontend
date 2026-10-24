import type { Metadata } from "next";
import { Alert } from "@/shared/ui";
import { ActionLink } from "@/components/ui/primitives";
import { AuthShell } from "@/features/auth/auth-shell";
import VerifyEmailClient from "./verify-email-client";

export const metadata: Metadata = { title: "Xác minh email" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthShell eyebrow="Tài khoản" title="Xác minh email">
      {token ? (
        <VerifyEmailClient />
      ) : (
        <div className="stack">
          <Alert>Liên kết xác minh không hợp lệ hoặc đã hết hạn.</Alert>
          <ActionLink href="/register" secondary>
            Đăng ký lại
          </ActionLink>
        </div>
      )}
    </AuthShell>
  );
}
