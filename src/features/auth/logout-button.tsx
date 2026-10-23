"use client";
import { useState } from "react";
import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/api/error";

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
    <>
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="menu-item menu-item-button"
        // Browser extensions add `fdprocessedid` to <button> before hydration,
        // which causes a hydration mismatch on the account menu.
        suppressHydrationWarning
      >
        {busy ? "Đang đăng xuất…" : "Đăng xuất"}
      </button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
