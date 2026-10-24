"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/shared/api/client";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { Alert, Button } from "@/shared/ui";
import { Field, PasswordField } from "@/components/ui/primitives";
import { GoogleLoginButton } from "@/features/auth/google-login-button";
import { HOME_BY_ROLE } from "./roles";

const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

export default function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const user = await api.login({
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      });
      // Full navigation clears cached protected content after the session changes.
      window.location.assign(HOME_BY_ROLE[user.role]);
    } catch (caught) {
      setError(getErrorMessage(caught));
      if (caught instanceof ApiError)
        setFields(
          Object.fromEntries(
            Object.entries(caught.errors ?? {}).map(([key, messages]) => [
              key.toLowerCase(),
              messages.join(" "),
            ]),
          ),
        );
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {error && <Alert>{error}</Alert>}
      {googleEnabled && (
        <>
          <div className="login-social">
            <GoogleLoginButton
              role="TRAVELER"
              onError={setError}
              disabled={busy}
            />
          </div>
          <div className="auth-divider" role="separator" aria-label="Hoặc">
            <span>Hoặc</span>
          </div>
        </>
      )}
      <form onSubmit={submit} className="stack" noValidate aria-busy={busy}>
        <Field
          label="Email"
          name="email"
          type="email"
          placeholder="ban@example.com"
          autoComplete="username"
          maxLength={255}
          required
          disabled={busy}
          error={fields.email}
        />
        <PasswordField
          label="Mật khẩu"
          name="password"
          autoComplete="current-password"
          required
          disabled={busy}
          error={fields.password}
        />
        <div className="between">
          <Link href="/forgot-password" className="text-link">
            Quên mật khẩu?
          </Link>
        </div>
        <Button type="submit" loading={busy} className="full-width">
          Đăng nhập
        </Button>
      </form>
    </div>
  );
}
