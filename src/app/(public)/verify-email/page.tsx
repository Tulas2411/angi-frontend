import Brand from "@/components/brand";
import VerifyEmailClient from "./verify-email-client";

export const metadata = {
  title: "Xác minh email",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="auth-page">
      <div className="container">
        <Brand />
      </div>
      <div className="container" style={{ maxWidth: 480 }}>
        {token ? (
          <VerifyEmailClient />
        ) : (
          <div className="alert alert-error">
            Liên kết xác minh không hợp lệ hoặc đã hết hạn.
          </div>
        )}
      </div>
    </main>
  );
}
