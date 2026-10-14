"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/shared/api/client";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { Alert, Input } from "@/shared/ui";

type SocialProvider = "facebook" | "google" | "apple";

export default function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [remember, setRemember] = useState(true);

  function social(provider: SocialProvider) {
    setSocialBusy(provider);
    setError(
      `Đăng nhập bằng ${labelOf(provider)} chưa được kích hoạt trong bản minh họa.`,
    );
    setTimeout(() => setSocialBusy(null), 600);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const user = await api.login({
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      });
      void user;
      window.location.assign("/demo/traveler");
    } catch (caught) {
      setError(getErrorMessage(caught));
      if (caught instanceof ApiError) setFields(caught.errors ?? {});
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <header className="login-header">
        <h1>Login to view this page</h1>
      </header>
      {error && <Alert>{error}</Alert>}

      <div className="login-social">
        <button
          type="button"
          className="login-social-btn login-social-btn--facebook"
          onClick={() => social("facebook")}
          disabled={busy || socialBusy !== null}
        >
          <FacebookIcon />
          <span>Tiếp tục với Facebook</span>
        </button>
        <button
          type="button"
          className="login-social-btn login-social-btn--google"
          onClick={() => social("google")}
          disabled={busy || socialBusy !== null}
        >
          <GoogleIcon />
          <span>Tiếp tục với Google</span>
        </button>
        <button
          type="button"
          className="login-social-btn login-social-btn--apple"
          onClick={() => social("apple")}
          disabled={busy || socialBusy !== null}
        >
          <AppleIcon />
          <span>Tiếp tục với Apple</span>
        </button>
      </div>

      <div className="login-divider" role="separator" aria-label="Hoặc">
        <span>Hoặc</span>
      </div>

      <form onSubmit={submit} className="login-form" noValidate>
        <div className="login-field">
          <label htmlFor="email" className="login-label">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="Enter your email address"
            autoComplete="username"
            maxLength={255}
            required
            disabled={busy}
            aria-invalid={!!fields.email}
            aria-describedby={fields.email ? "email-error" : undefined}
            className="login-input"
          />
          {fields.email && (
            <p id="email-error" className="login-error">
              {fields.email.join(" ")}
            </p>
          )}
        </div>

        <div className="login-field">
          <label htmlFor="password" className="login-label">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            disabled={busy}
            aria-invalid={!!fields.password}
            aria-describedby={fields.password ? "password-error" : undefined}
            className="login-input"
          />
          {fields.password && (
            <p id="password-error" className="login-error">
              {fields.password.join(" ")}
            </p>
          )}
        </div>

        <div className="login-row">
          <label className="login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={busy}
            />
            <span>Ghi nhớ đăng nhập</span>
          </label>
          <Link href="/forgot-password" className="login-link">
            Quên mật khẩu?
          </Link>
        </div>

        <button type="submit" disabled={busy} className="login-submit">
          {busy ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>

      <p className="login-footer">
        Bạn chưa có tài khoản?{" "}
        <Link href="/register" className="login-link-strong">
          Đăng ký ngay
        </Link>
      </p>
    </div>
  );
}

function labelOf(provider: SocialProvider) {
  return provider === "facebook"
    ? "Facebook"
    : provider === "google"
      ? "Google"
      : "Apple";
}

function FacebookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#FFFFFF"
        d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.025 4.388 11.02 10.125 11.927v-8.437H7.078v-3.49h3.047V9.43c0-3.018 1.792-4.685 4.533-4.685 1.313 0 2.686.235 2.686.235v2.969h-1.514c-1.491 0-1.955.93-1.955 1.886v2.266h3.328l-.532 3.49h-2.796v8.437C19.612 23.094 24 18.099 24 12.073z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
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

function AppleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#000"
        d="M16.365 1.43c0 1.14-.42 2.21-1.18 3.04-.84.92-2.21 1.62-3.34 1.53-.14-1.1.4-2.27 1.16-3.07.85-.92 2.27-1.62 3.36-1.5zM20.5 17.36c-.55 1.27-.81 1.84-1.51 2.96-1 1.59-2.41 3.57-4.16 3.59-1.55.02-1.95-1.01-4.06-1-2.11.01-2.55 1.02-4.1 1-1.74-.02-3.07-1.81-4.07-3.4-2.79-4.45-3.08-9.67-1.36-12.45 1.22-1.97 3.14-3.12 4.95-3.12 1.84 0 3 1.02 4.52 1.02 1.47 0 2.37-1.02 4.5-1.02 1.61 0 3.32.88 4.54 2.4-3.99 2.19-3.34 7.89.75 10.02z"
      />
    </svg>
  );
}
