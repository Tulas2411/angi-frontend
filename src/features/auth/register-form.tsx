"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Alert, Button } from "@/shared/ui";
import {
  ActionLink,
  Choice,
  Field,
  PasswordField,
} from "@/components/ui/primitives";
import { api } from "@/shared/api/client";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import type { RegisterableRole } from "./types";

// Client-side mirrors of the AUTH-01 contract. Backend remains authoritative for
// every rule and returns its own field-level errors via ApiError.errors.
const EMAIL_MAX = 255;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 64;
const NAME_MIN = 2;
const NAME_MAX = 100;

function validate(values: {
  name: string;
  email: string;
  password: string;
  confirm: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = values.name.trim();
  if (!name) errors.name = "Tên hiển thị là bắt buộc.";
  else if ([...name].length < NAME_MIN)
    errors.name = `Tên hiển thị phải có ít nhất ${NAME_MIN} ký tự.`;
  else if ([...name].length > NAME_MAX)
    errors.name = `Tên hiển thị không được vượt quá ${NAME_MAX} ký tự.`;

  const email = values.email.trim();
  if (!email) errors.email = "Email là bắt buộc.";
  else if (email.length > EMAIL_MAX)
    errors.email = `Email không được vượt quá ${EMAIL_MAX} ký tự.`;

  const pwd = values.password;
  if (!pwd) errors.password = "Mật khẩu là bắt buộc.";
  else if (pwd.length < PASSWORD_MIN)
    errors.password = `Mật khẩu phải có ít nhất ${PASSWORD_MIN} ký tự.`;
  else if (pwd.length > PASSWORD_MAX)
    errors.password = `Mật khẩu không được vượt quá ${PASSWORD_MAX} ký tự.`;
  else if (!/[A-Za-z]/.test(pwd))
    errors.password = "Mật khẩu phải có ít nhất một chữ cái.";
  else if (!/[0-9]/.test(pwd))
    errors.password = "Mật khẩu phải có ít nhất một chữ số.";

  if (values.confirm !== pwd)
    errors.confirm = "Mật khẩu xác nhận chưa trùng khớp.";
  return errors;
}

function PendingVerification({ email }: { email: string }) {
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [resending, setResending] = useState(false);
  const [resend, setResend] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  async function handleResend() {
    setResending(true);
    setResend(null);
    try {
      await api.resendVerification(email);
      setResend({
        tone: "success",
        message: "Đã gửi lại email xác minh. Vui lòng kiểm tra hộp thư.",
      });
      setSecondsLeft(60);
    } catch (caught) {
      setResend({ tone: "error", message: getErrorMessage(caught) });
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="stack">
      <Alert tone="info">
        Kiểm tra hộp thư <strong>{email}</strong> để xác minh email trước khi
        đăng nhập.
      </Alert>
      <p className="helper">
        Liên kết xác minh có hiệu lực trong 24 giờ. Nếu không thấy email, hãy
        kiểm tra thư mục spam.
      </p>
      {resend && <Alert tone={resend.tone}>{resend.message}</Alert>}
      <div className="stack-sm">
        <Button
          type="button"
          onClick={handleResend}
          disabled={secondsLeft > 0}
          loading={resending}
          className="full-width"
        >
          {secondsLeft > 0 ? `Gửi lại sau ${secondsLeft}s` : "Gửi lại liên kết"}
        </Button>
        <ActionLink href="/" secondary className="full-width">
          Về trang chủ
        </ActionLink>
      </div>
    </div>
  );
}

export default function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<RegisterableRole>("TRAVELER");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ email: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const clientErrors = validate({ name, email, password, confirm });
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setTopError(null);
      return;
    }
    setBusy(true);
    setFieldErrors({});
    setTopError(null);
    try {
      const result = await api.register({
        email: email.trim().toLowerCase(),
        password,
        displayName: name.trim(),
        role,
      });
      // Lưu email để hiển thị trên trang verify-success sau khi xác minh
      localStorage.setItem("pending_verification_email", result.email);
      setSubmitted({ email: result.email });
    } catch (caught) {
      if (caught instanceof ApiError) {
        const server = Object.fromEntries(
          Object.entries(caught.errors ?? {}).map(([key, messages]) => [
            key.toLowerCase() === "displayname" ? "name" : key.toLowerCase(),
            messages.join(" "),
          ]),
        );
        setFieldErrors(
          caught.errorCode === "EMAIL_ALREADY_EXISTS"
            ? { ...server, email: server.email ?? "Email đã được sử dụng." }
            : server,
        );
      }
      setTopError(getErrorMessage(caught));
      setBusy(false);
    }
  }

  if (submitted) return <PendingVerification email={submitted.email} />;

  return (
    <form onSubmit={submit} className="stack" noValidate aria-busy={busy}>
      {topError && <Alert>{topError}</Alert>}
      <Field
        label="Tên hiển thị"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoComplete="name"
        minLength={NAME_MIN}
        maxLength={NAME_MAX}
        error={fieldErrors.name}
        disabled={busy}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        maxLength={EMAIL_MAX}
        error={fieldErrors.email}
        disabled={busy}
      />
      <PasswordField
        label="Mật khẩu"
        name="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
        maxLength={PASSWORD_MAX}
        error={fieldErrors.password}
        helper={`${PASSWORD_MIN}–${PASSWORD_MAX} ký tự, ít nhất một chữ cái và một chữ số.`}
        disabled={busy}
      />
      <PasswordField
        label="Nhập lại mật khẩu"
        name="confirm"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        autoComplete="new-password"
        maxLength={PASSWORD_MAX}
        error={fieldErrors.confirm}
        disabled={busy}
      />
      <fieldset className="role-fieldset" disabled={busy}>
        <legend>Bạn muốn sử dụng ANGI với vai trò nào? *</legend>
        <div className="role-grid">
          <Choice
            kind="radio"
            name="role"
            value="TRAVELER"
            label="Người khám phá"
            checked={role === "TRAVELER"}
            onChange={() => setRole("TRAVELER")}
            disabled={busy}
          />
          <Choice
            kind="radio"
            name="role"
            value="RESTAURANT_OWNER"
            label="Chủ nhà hàng"
            checked={role === "RESTAURANT_OWNER"}
            onChange={() => setRole("RESTAURANT_OWNER")}
            disabled={busy}
          />
        </div>
        {fieldErrors.role && <p className="field-error">{fieldErrors.role}</p>}
      </fieldset>
      <Button type="submit" loading={busy} className="full-width">
        Tạo tài khoản
      </Button>
      <p className="auth-footer-inline">
        Đã có tài khoản?{" "}
        <Link href="/login" className="text-link">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
