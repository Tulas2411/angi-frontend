"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Card } from "@/shared/ui";

export default function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Liên kết xác minh không hợp lệ.");
      return;
    }

    async function verify() {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
        if (!baseUrl) {
          setStatus("error");
          setErrorMessage("Thiếu cấu hình NEXT_PUBLIC_API_BASE_URL.");
          return;
        }
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          const email = localStorage.getItem("pending_verification_email") || "";
          localStorage.removeItem("pending_verification_email");
          router.push(`/verify-success${email ? `?email=${encodeURIComponent(email)}` : ""}`);
        } else {
          setStatus("error");
          setErrorMessage(data.message || "Xác minh email thất bại.");
        }
      } catch {
        setStatus("error");
        setErrorMessage("Không thể kết nối server. Vui lòng thử lại.");
      }
    }

    verify();
  }, [token, router]);

  if (status === "loading") {
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
        <a href="/" className="button button-tertiary">← Về trang chủ</a>
        <a href="/register" className="button button-secondary">Đăng ký lại</a>
      </div>
    </Card>
  );
}
