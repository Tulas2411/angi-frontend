import Brand from "@/components/brand";
import { AuthFlowPage } from "@/features/auth/flows";
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
      <AuthFlowPage flow="setup-password" tokenPresent={Boolean(token)} />
    </main>
  );
}
