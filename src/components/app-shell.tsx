import Link from "next/link";
import type { ReactNode } from "react";
import Brand from "./brand";
import type { AuthUserDto } from "@/features/auth/types";
import { HOME_BY_ROLE, LABEL_BY_ROLE } from "@/features/auth/roles";
import { LogoutButton } from "@/features/auth/session-panel";

export default function AppShell({
  user,
  children,
}: {
  user: AuthUserDto;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Brand href={HOME_BY_ROLE[user.role]} />
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-stone-600 sm:inline">
              {user.displayName}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 md:grid-cols-[210px_minmax(0,1fr)]">
        <aside>
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.15em] text-stone-400">
            {LABEL_BY_ROLE[user.role]}
          </p>
          <nav aria-label="Điều hướng chính" className="space-y-2">
            <Link
              href={HOME_BY_ROLE[user.role]}
              className="block rounded-xl bg-orange-100 px-4 py-3 text-sm font-semibold text-orange-900"
            >
              Tổng quan
            </Link>
            {user.role === "ADMIN" && (
              <Link
                href="/moderation"
                className="block rounded-xl px-4 py-3 text-sm hover:bg-white"
              >
                Kiểm duyệt
              </Link>
            )}
            <Link
              href="/"
              className="block rounded-xl px-4 py-3 text-sm text-stone-500 hover:bg-white"
            >
              Trang chủ ↗
            </Link>
          </nav>
          <div className="mt-10 rounded-xl border border-stone-200 p-4">
            <p className="text-sm font-semibold">Mỗi bữa ăn là một khởi đầu.</p>
            <p className="mt-2 text-xs leading-6 text-stone-500">
              Cùng ANGI khám phá những điều mới.
            </p>
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
