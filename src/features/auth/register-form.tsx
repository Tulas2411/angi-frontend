"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Alert, Button, Card, Input } from "@/shared/ui";
import { Choice } from "@/components/ui/primitives";
import { api } from "@/shared/api/client";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { HOME_BY_ROLE } from "./roles";
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
}): { fieldErrors: Record<string, string[]> } {
  const fieldErrors: Record<string, string[]> = {};
  const name = values.name.trim();
  if (!name) fieldErrors.name = ["Tên hiển thị là bắt buộc."];
  else if ([...name].length < NAME_MIN)
    fieldErrors.name = [`Tên hiển thị phải có ít nhất ${NAME_MIN} ký tự.`];
  else if ([...name].length > NAME_MAX)
    fieldErrors.name = [`Tên hiển thị không được vượt quá ${NAME_MAX} ký tự.`];

  const email = values.email.trim();
  if (!email) fieldErrors.email = ["Email là bắt buộc."];
  else if (email.length > EMAIL_MAX)
    fieldErrors.email = [`Email không được vượt quá ${EMAIL_MAX} ký tự.`];

  const pwd = values.password;
  if (!pwd) fieldErrors.password = ["Mật khẩu là bắt buộc."];
  else if (pwd.length < PASSWORD_MIN)
    fieldErrors.password = [`Mật khẩu phải có ít nhất ${PASSWORD_MIN} ký tự.`];
  else if (pwd.length > PASSWORD_MAX)
    fieldErrors.password = [`Mật khẩu không được vượt quá ${PASSWORD_MAX} ký tự.`];
  else if (!/[A-Za-z]/.test(pwd))
    fieldErrors.password = ["Mật khẩu phải có ít nhất một chữ cái."];
  else if (!/[0-9]/.test(pwd))
    fieldErrors.password = ["Mật khẩu phải có ít nhất một chữ số."];

  if (values.confirm !== pwd)
    fieldErrors.confirm = ["Mật khẩu xác nhận chưa trùng khớp."];

  return { fieldErrors };
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  maxLength,
  error,
  helper,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  autoComplete: string;
  maxLength: number;
  error?: string;
  helper?: string;
  disabled: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} *
      </label>
      <div className="password-row">
        <Input
          id={id}
          name={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          minLength={PASSWORD_MIN}
          maxLength={maxLength}
          aria-invalid={!!error}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShow((s) => !s)}
          disabled={disabled}
          aria-pressed={show}
        >
          {show ? "Ẩn" : "Hiện"}
        </Button>
      </div>
      <p className={error ? "field-error" : "helper"}>
        {error || helper}
      </p>
    </div>
  );
}

function RoleOption({
  value,
  label,
  checked,
  onSelect,
  disabled,
}: {
  value: RegisterableRole;
  label: string;
  checked: boolean;
  onSelect: (value: RegisterableRole) => void;
  disabled: boolean;
}) {
  return (
    <Choice
      kind="radio"
      name="role"
      value={value}
      label={label}
      checked={checked}
      onChange={() => onSelect(value)}
      disabled={disabled}
    />
  );
}

function PendingVerification({ email }: { email: string }) {
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  async function handleResend() {
    setResending(true);
    setResendMessage(null);
    try {
      await api.resendVerification(email);
      setResendMessage("Đã gửi lại email xác minh. Vui lòng kiểm tra hộp thư.");
      setSecondsLeft(60);
    } catch (caught) {
      setResendMessage(getErrorMessage(caught));
    } finally {
      setResending(false);
    }
  }

  return (
    <Card className="stack">
      <Alert tone="info">
        Kiểm tra hộp thư <strong>{email}</strong> để xác minh email trước khi
        đăng nhập.
      </Alert>
      <p className="helper">
        Liên kết xác minh có hiệu lực trong 24 giờ. Nếu không thấy email, kiểm
        tra thư mục spam.
      </p>
      {resendMessage && (
        <Alert tone={resendMessage.startsWith("Đã gửi") ? "success" : "error"}>
          {resendMessage}
        </Alert>
      )}
      <div className="auth-links-vertical">
        <Button
          type="button"
          variant="primary"
          onClick={handleResend}
          disabled={secondsLeft > 0 || resending}
          loading={resending}
          className="auth-link-button"
        >
          {secondsLeft > 0
            ? `Gửi lại sau ${secondsLeft}s`
            : "Gửi lại liên kết"}
        </Button>
        <Link href={HOME_BY_ROLE.TRAVELER} className="button button-primary auth-link-button">
          Về trang chủ
        </Link>
      </div>
    </Card>
  );
}

export default function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<RegisterableRole>("TRAVELER");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ email: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { fieldErrors: clientErrors } = validate({
      name,
      email,
      password,
      confirm,
    });
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
        if (caught.errorCode === "EMAIL_ALREADY_EXISTS") {
          setFieldErrors({
            ...(caught.errors ?? {}),
            email: caught.errors?.email ?? ["Email đã được sử dụng."],
          });
        } else {
          setFieldErrors(caught.errors ?? {});
        }
        setTopError(getErrorMessage(caught));
      } else {
        setTopError(getErrorMessage(caught));
      }
      setBusy(false);
    }
  }

  if (submitted) {
    return <PendingVerification email={submitted.email} />;
  }

  return (
    <Card className="stack">
      <form onSubmit={submit} className="stack" noValidate>
        {topError && <Alert>{topError}</Alert>}
        <div className="field">
          <label htmlFor="name">Tên hiển thị *</label>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            minLength={NAME_MIN}
            maxLength={NAME_MAX}
            aria-invalid={!!fieldErrors.name?.[0]}
            disabled={busy}
          />
          {fieldErrors.name?.[0] && (
            <p className="field-error">{fieldErrors.name[0]}</p>
          )}
        </div>
        <div className="field">
          <label htmlFor="email">Email *</label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            maxLength={EMAIL_MAX}
            aria-invalid={!!fieldErrors.email?.[0]}
            disabled={busy}
          />
          {fieldErrors.email?.[0] && (
            <p className="field-error">{fieldErrors.email[0]}</p>
          )}
        </div>
        <PasswordField
          id="password"
          label="Mật khẩu"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          error={fieldErrors.password?.[0]}
          helper={`${PASSWORD_MIN}–${PASSWORD_MAX} ký tự, ít nhất một chữ cái và một chữ số.`}
          disabled={busy}
        />
        <PasswordField
          id="confirm"
          label="Nhập lại mật khẩu"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          error={fieldErrors.confirm?.[0]}
          disabled={busy}
        />
        <div
          className="stack-sm"
          role="radiogroup"
          aria-label="Bạn muốn sử dụng ANGI với vai trò nào?"
        >
          <span className="field-label">
            Bạn muốn sử dụng ANGI với vai trò nào? *
          </span>
          <div className="role-grid">
            <RoleOption
              value="TRAVELER"
              label="Người khám phá"
              checked={role === "TRAVELER"}
              onSelect={setRole}
              disabled={busy}
            />
            <RoleOption
              value="RESTAURANT_OWNER"
              label="Chủ nhà hàng"
              checked={role === "RESTAURANT_OWNER"}
              onSelect={setRole}
              disabled={busy}
            />
          </div>
          {fieldErrors.role?.[0] && (
            <p className="field-error">{fieldErrors.role[0]}</p>
          )}
        </div>
        <div className="between auth-links">
          <Button
            type="submit"
            loading={busy}
            className="full-width"
            style={{ maxWidth: 240 }}
          >
            Tạo tài khoản
          </Button>
          <Link href="/login" className="button button-secondary">
            Đăng nhập
          </Link>
        </div>
      </form>
    </Card>
  );
}
