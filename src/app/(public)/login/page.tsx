import { redirect } from "next/navigation";
import Link from "next/link";
import Brand from "@/components/brand";
import LoginForm from "@/features/auth/login-form";
import { getSession, readAuth } from "@/features/auth/server";
import { HOME_BY_ROLE } from "@/features/auth/roles";
import { Alert } from "@/shared/ui";
import { ApiError, getErrorMessage } from "@/shared/api/error";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const auth = readAuth(await getSession());
  if (auth) redirect(HOME_BY_ROLE[auth.user.role]);
  const { reason } = await searchParams;
  const known = [
    "UNAUTHORIZED",
    "REFRESH_TOKEN_INVALID",
    "ACCOUNT_BANNED",
    "ACCOUNT_SUSPENDED",
    "ACCOUNT_DEACTIVATED",
  ];
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-2">
      <section className="flex flex-col px-6 py-8 lg:px-16">
        <Brand />
        <div className="mx-auto my-auto w-full max-w-sm py-16">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
            Chào mừng trở lại
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Đăng nhập ANGI</h1>
          <p className="mb-8 mt-3 text-sm leading-7 text-stone-500">
            Tiếp tục hành trình khám phá hương vị của bạn.
          </p>
          {reason && known.includes(reason) && (
            <div className="mb-5">
              <Alert>
                {getErrorMessage(
                  new ApiError(401, reason, "Vui lòng đăng nhập lại."),
                )}
              </Alert>
            </div>
          )}
          <LoginForm />
          <Link
            href="/"
            className="mt-7 block text-center text-sm text-stone-500"
          >
            ← Về trang chủ
          </Link>
        </div>
        <p className="text-xs text-stone-400">ANGI — Ăn Gì</p>
      </section>
      <aside className="hidden flex-col justify-between bg-[#e9eee2] p-16 lg:flex">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900/60">
          Ăn ngon · Đi xa · Kể chuyện
        </span>
        <div>
          <span className="text-7xl" aria-hidden>
            🍲
          </span>
          <h2 className="mt-8 text-4xl font-bold leading-tight text-emerald-950">
            Một món ăn,
            <br />
            một điều để nhớ.
          </h2>
          <p className="mt-5 max-w-sm leading-8 text-emerald-950/65">
            Bắt đầu từ khẩu vị của bạn, mở ra những trải nghiệm mới.
          </p>
        </div>
        <p className="text-sm text-emerald-950/60">
          Hương vị của mỗi hành trình.
        </p>
      </aside>
    </main>
  );
}
