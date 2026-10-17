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
  variant?: "full" | "icon-only";
  /**
   * Role to assign when Google login creates a new account. The backend
   * accepts only TRAVELER or RESTAURANT_OWNER. Existing accounts keep
   * their persisted role, so this value is ignored on subsequent sign-ins.
   */
  role?: RegisterableRole;
}

export function GoogleLoginButton({
  onSuccess,
  onError,
  disabled,
  variant = "full",
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
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
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

  if (!clientId) {
    return (
      <div className="login-social-btn login-social-btn--google login-social-btn--disabled">
        <GoogleIcon />
        <span>Google chưa được cấu hình</span>
      </div>
    );
  }

  return (
    <>
      <div inert={disabled} aria-disabled={disabled}>
        <GoogleLogin
          type={variant === "icon-only" ? "icon" : "standard"}
          onSuccess={handleSuccess}
          onError={handleError}
          useOneTap={false}
          theme="outline"
          size="large"
          text="signin_with"
          shape="rectangular"
          logo_alignment="left"
        />
      </div>
      {error && <Alert>{error}</Alert>}
    </>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.275c0-.78-.07-1.53-.2-2.25H12v4.51h6.46c-.28 1.43-1.1 2.64-2.34 3.46v2.87h3.78c2.21-2.04 3.49-5.04 3.49-8.59z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.15 0 5.79-1.05 7.72-2.85l-3.78-2.87c-1.05.7-2.39 1.12-3.94 1.12-3.03 0-5.6-2.05-6.51-4.79H1.55v2.99A11.997 11.997 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.49 14.61A7.21 7.21 0 0 1 5.13 12c0-.91.16-1.79.36-2.61V6.4H1.55A11.997 11.997 0 0 0 .01 12c0 1.94.46 3.77 1.54 5.6l3.94-2.99z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.71 0 3.24.59 4.45 1.74l3.34-3.34C17.78 1.18 15.13 0 12 0A11.997 11.997 0 0 0 1.55 6.4l3.94 2.99C6.4 6.82 8.97 4.77 12 4.77z"
      />
    </svg>
  );
}
