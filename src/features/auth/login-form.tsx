"use client";
import { useState, type FormEvent } from "react";
import { HOME_BY_ROLE } from "./roles";
import { api } from "@/shared/api/client";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { Alert, Button, Input } from "@/shared/ui";

export default function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
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
      window.location.assign(HOME_BY_ROLE[user.role]);
    } catch (caught) {
      setError(getErrorMessage(caught));
      if (caught instanceof ApiError) setFields(caught.errors ?? {});
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <Alert>{error}</Alert>}
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="ban@example.com"
          autoComplete="username"
          maxLength={255}
          required
          disabled={busy}
          aria-invalid={!!fields.email}
          aria-describedby={fields.email ? "email-error" : undefined}
        />
        {fields.email && (
          <p id="email-error" className="text-xs text-red-700">
            {fields.email.join(" ")}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Mật khẩu
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Nhập mật khẩu của bạn"
          autoComplete="current-password"
          required
          disabled={busy}
          aria-invalid={!!fields.password}
          aria-describedby={fields.password ? "password-error" : undefined}
        />
        {fields.password && (
          <p id="password-error" className="text-xs text-red-700">
            {fields.password.join(" ")}
          </p>
        )}
      </div>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Đang đăng nhập..." : "Đăng nhập →"}
      </Button>
    </form>
  );
}
