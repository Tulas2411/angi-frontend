"use client";
import { GoogleLogin } from "@react-oauth/google";
import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/api/error";
import { useState } from "react";
import { Alert } from "@/shared/ui";
import { HOME_BY_ROLE } from "./roles";
import type { RegisterableRole } from "./types";

interface GoogleLoginButtonProps {
  onSuccess?: (isNewUser: boolean) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  /**
   * Role to assign when Google login creates a new account. The backend
   * accepts only TRAVELER or RESTAURANT_OWNER. Existing accounts keep
   * their persisted role, so this value is ignored on subsequent sign-ins.
   */
  role?: RegisterableRole;
}

/** Renders only when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is configured; there is no inert fallback button. */
export function GoogleLoginButton({
  onSuccess,
  onError,
  disabled,
  role,
}: GoogleLoginButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  async function handleSuccess(response: { credential?: string }) {
    if (disabled) return;
    const token = response.credential;
    if (!token) {
      handleError();
      return;
    }
    setError(null);
    try {
      const result = await api.googleLogin({ idToken: token, role });
      onSuccess?.(result.isNewUser);
      // Full navigation clears cached protected content after the session changes.
      // The backend returns the persisted role (existing user) or the role we
      // just requested (new user), so we always redirect to the correct home.
      window.location.assign(HOME_BY_ROLE[result.user.role]);
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      onError?.(msg);
    }
  }

  function handleError() {
    const msg = "Đăng nhập Google thất bại. Vui lòng thử lại.";
    setError(msg);
    onError?.(msg);
  }

  if (!clientId) return null;

  return (
    <>
      <div inert={disabled} aria-disabled={disabled}>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={handleError}
          useOneTap={false}
          theme="outline"
          size="large"
          text="signin_with"
          shape="pill"
          logo_alignment="left"
        />
      </div>
      {error && !onError && <Alert>{error}</Alert>}
    </>
  );
}
