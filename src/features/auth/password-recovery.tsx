"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Alert, Button } from "@/shared/ui";
import { ActionLink, Field, PasswordField } from "@/components/ui/primitives";
import { api } from "@/shared/api/client";
import { ApiError, getErrorMessage } from "@/shared/api/error";

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 64;

/** AUTH-08. The API never reveals whether the email exists, so success looks the same either way. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const value = email.trim().toLowerCase();
    if (!value) {
      setError("Nhập email của tài khoản.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.forgotPassword(value);
      setSentTo(value);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  if (sentTo)
    return (
      <div className="stack">
        <Alert tone="success">
          Nếu <strong>{sentTo}</strong> có trong hệ thống, chúng tôi vừa gửi
          liên kết đặt lại mật khẩu. Liên kết có hiệu lực trong 30 phút.
        </Alert>
        <ActionLink href="/login" secondary>
          Quay lại đăng nhập
        </ActionLink>
      </div>
    );
  return (
    <form className="stack" noValidate onSubmit={submit} aria-busy={busy}>
      {error && <Alert>{error}</Alert>}
      <Field
        label="Email"
        name="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        maxLength={255}
        autoComplete="email"
        disabled={busy}
      />
      <Button type="submit" loading={busy} className="full-width">
        Gửi liên kết đặt lại
      </Button>
      <p className="auth-footer-inline">
        Đã nhớ mật khẩu?{" "}
        <Link href="/login" className="text-link">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}

/** AUTH-09. The token comes from the emailed link; the page redirects when it is missing. */
export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const invalid: Record<string, string> = {};
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX)
      invalid.password = `Mật khẩu phải từ ${PASSWORD_MIN} đến ${PASSWORD_MAX} ký tự.`;
    else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
      invalid.password = "Mật khẩu cần có ít nhất một chữ cái và một chữ số.";
    else if (confirm !== password)
      invalid.confirm = "Mật khẩu xác nhận chưa trùng khớp.";
    setErrors(invalid);
    setError("");
    if (Object.keys(invalid).length) return;
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        ["TOKEN_INVALID", "TOKEN_EXPIRED", "TOKEN_ALREADY_USED"].includes(
          caught.errorCode,
        )
      )
        setExpired(true);
      else {
        if (caught instanceof ApiError && caught.errors?.newPassword)
          setErrors({ password: caught.errors.newPassword.join(" ") });
        setError(getErrorMessage(caught));
      }
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div className="stack">
        <Alert tone="success">
          Mật khẩu của bạn đã được cập nhật. Các phiên đăng nhập cũ đã bị đăng
          xuất; hãy đăng nhập bằng mật khẩu mới.
        </Alert>
        <ActionLink href="/login">Đăng nhập</ActionLink>
      </div>
    );
  if (expired)
    return (
      <div className="stack">
        <Alert>
          Liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng. Hãy yêu cầu
          một liên kết mới.
        </Alert>
        <ActionLink href="/forgot-password">Yêu cầu liên kết mới</ActionLink>
      </div>
    );
  return (
    <form className="stack" noValidate onSubmit={submit} aria-busy={busy}>
      {error && <Alert>{error}</Alert>}
      <PasswordField
        label="Mật khẩu mới"
        name="newPassword"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        maxLength={PASSWORD_MAX}
        autoComplete="new-password"
        error={errors.password}
        helper={`${PASSWORD_MIN}–${PASSWORD_MAX} ký tự, ít nhất một chữ cái và một chữ số.`}
        disabled={busy}
      />
      <PasswordField
        label="Nhập lại mật khẩu"
        name="confirmPassword"
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        required
        maxLength={PASSWORD_MAX}
        autoComplete="new-password"
        error={errors.confirm}
        disabled={busy}
      />
      <Button type="submit" loading={busy} className="full-width">
        Đặt lại mật khẩu
      </Button>
    </form>
  );
}
