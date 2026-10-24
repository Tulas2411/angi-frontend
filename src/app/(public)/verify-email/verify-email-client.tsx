"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Card } from "@/shared/ui";

export default function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const verification = useRef<{
    token: string;
    baseUrl: string;
    request: Promise<Response>;
  } | null>(null);
  const [failure, setFailure] = useState<{
    token: string;
    message: string;
  } | null>(null);
  const errorMessage = !token
    ? "Liên kết xác minh không hợp lệ."
    : !baseUrl
      ? "Thiếu cấu hình NEXT_PUBLIC_API_BASE_URL."
      : failure?.token === token
        ? failure.message
        : "";

  useEffect(() => {
    if (!token || !baseUrl) return;
    let active = true;
    // Reuse the request when Strict Mode replays the effect for this token.
    if (
      verification.current?.token !== token ||
      verification.current.baseUrl !== baseUrl
    ) {
      verification.current = {
        token,
        baseUrl,
        request: fetch(`${baseUrl.replace(/\/$/, "")}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }),
      };
    }

    async function verify(currentToken: string, request: Promise<Response>) {
      try {
        const response = await request;
        const data = await response.clone().json();
        if (!active) return;

        if (response.ok && data.success) {
          const email =
            localStorage.getItem("pending_verification_email") || "";
          localStorage.removeItem("pending_verification_email");
          router.push(
            `/verify-success${email ? `?email=${encodeURIComponent(email)}` : ""}`,
          );
        } else {
          setFailure({
            token: currentToken,
            message: data.message || "Xác minh email thất bại.",
          });
        }
      } catch {
        if (active)
          setFailure({
            token: currentToken,
            message: "Không thể kết nối server. Vui lòng thử lại.",
          });
      }
    }

    void verify(token, verification.current.request);
    return () => {
      active = false;
    };
  }, [token, baseUrl, router]);

  if (!errorMessage) {
    return (
      <Card className="stack">
        <Alert tone="info">Đang xác minh email...</Alert>
      </Card>
    );
  }

  return (
    <Card className="stack">
      <Alert tone="error">{errorMessage}</Alert>
      <div className="between auth-links">
        <Link href="/" className="button button-tertiary">
          ← Về trang chủ
        </Link>
        <Link href="/register" className="button button-secondary">
          Đăng ký lại
        </Link>
      </div>
    </Card>
  );
}
