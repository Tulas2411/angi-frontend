"use client";
import { useEffect, useState } from "react";
import type { AuthUserDto, RoleCode } from "./types";
import { HOME_BY_ROLE, LABEL_BY_ROLE } from "./roles";
import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/api/error";
import { Alert, Badge, Button } from "@/shared/ui";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function logout() {
    setBusy(true);
    setError(null);
    try {
      await api.logout();
      // Discard cached protected routes after the BFF removes the session cookie.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    } catch (caught) {
      setError(getErrorMessage(caught));
      setBusy(false);
    }
  }
  return (
    <div>
      <Button
        variant="secondary"
        type="button"
        onClick={logout}
        disabled={busy}
        className="px-4 py-2"
      >
        {busy ? "Đang đăng xuất..." : "Đăng xuất"}
      </Button>
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
    </div>
  );
}
export default function SessionPanel({
  expectedRole,
}: {
  expectedRole: RoleCode;
}) {
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api
      .session()
      .then((fresh) => {
        if (!active) return;
        if (fresh.role !== expectedRole) {
          window.location.replace(HOME_BY_ROLE[fresh.role]);
          return;
        }
        setUser(fresh);
      })
      .catch((caught) => {
        if (active) setError(getErrorMessage(caught));
      });
    return () => {
      active = false;
    };
  }, [expectedRole]);
  async function reload() {
    setBusy(true);
    setError(null);
    try {
      const fresh = await api.session();
      if (fresh.role !== expectedRole) {
        window.location.replace(HOME_BY_ROLE[fresh.role]);
        return;
      }
      setUser(fresh);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      {error && <Alert>{error}</Alert>}
      {user ? (
        <>
          <div className="flex items-center gap-4">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-lg font-semibold text-orange-800"
              aria-hidden
            >
              {user.displayName.charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="font-semibold">{user.displayName}</p>
              <p className="mt-1 break-all text-sm text-stone-500">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{LABEL_BY_ROLE[user.role]}</Badge>
            <Badge>Đang hoạt động</Badge>
          </div>
          {user.needsPreferenceSurvey === true && (
            <p className="rounded-xl bg-orange-50 p-3 text-sm leading-6 text-orange-900">
              Phần khảo sát khẩu vị sẽ sớm được mở để ANGI gợi ý món ăn phù hợp
              hơn.
            </p>
          )}
        </>
      ) : (
        !error && (
          <p className="text-sm text-stone-500" role="status">
            Đang tải thông tin tài khoản...
          </p>
        )
      )}
      <Button
        variant="secondary"
        type="button"
        onClick={reload}
        disabled={busy}
      >
        {busy ? "Đang kiểm tra..." : "Kiểm tra phiên đăng nhập"}
      </Button>
    </div>
  );
}
