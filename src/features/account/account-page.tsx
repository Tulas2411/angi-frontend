"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  Avatar,
  ConfirmDialog,
  Dialog,
  Field,
  PasswordField,
  Skeleton,
  TextArea,
} from "@/components/ui/primitives";
import { PageHeading } from "@/components/layout/page-heading";
import { LABEL_BY_ROLE } from "@/features/auth/roles";
import { api } from "@/shared/api/client";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { dateLabel } from "@/shared/format";
import {
  accountFieldErrors,
  BIO_MAX,
  buildPasswordRequest,
  buildProfilePatch,
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  PASSWORD_MAX,
  PASSWORD_MIN,
  PHONE_DIGITS,
  PHONE_MAX,
  PHONE_PREFIXES,
  profileFormFromProfile,
  validatePasswordForm,
  validatePhone,
  validateProfilePatch,
  type PasswordFormValues,
} from "./account-rules";
import { accountService } from "./account-service";
import type { ProfileFormValues, UserProfileDto } from "./account-types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; profile: UserProfileDto };

export function AccountPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let ignore = false;
    accountService
      .getProfile()
      .then((profile) => {
        if (!ignore) setState({ status: "ready", profile });
      })
      .catch((caught) => {
        if (!ignore)
          setState({ status: "error", message: getErrorMessage(caught) });
      });
    return () => {
      ignore = true;
    };
  }, [attempt]);
  if (state.status === "loading")
    return (
      <div className="stack">
        <PageHeading title="Tài khoản của bạn" />
        <Skeleton />
      </div>
    );
  if (state.status === "error")
    return (
      <div className="stack">
        <PageHeading title="Tài khoản của bạn" />
        <Card title="Chưa tải được thông tin tài khoản">
          <Alert>{state.message}</Alert>
          <div className="actions">
            <Button
              onClick={() => {
                setState({ status: "loading" });
                setAttempt((value) => value + 1);
              }}
            >
              Thử lại
            </Button>
          </div>
        </Card>
      </div>
    );
  return (
    <AccountEditor
      profile={state.profile}
      onSaved={(profile) => setState({ status: "ready", profile })}
    />
  );
}

function AccountEditor({
  profile,
  onSaved,
}: {
  profile: UserProfileDto;
  onSaved: (profile: UserProfileDto) => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProfileFormValues>(() =>
    profileFormFromProfile(profile),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const submitting = useRef(false);
  const patch = buildProfilePatch(values, profile);
  const dirty = Object.keys(patch).length > 0;

  function change(key: keyof ProfileFormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setSuccess("");
  }
  /** The phone field reports its own format error once the user left it. */
  function changePhone(value: string) {
    change("phone", value);
    if (phoneTouched) {
      const invalid = validatePhone(value);
      setErrors((current) => ({ ...current, phone: invalid ?? "" }));
    }
  }
  function blurPhone() {
    setPhoneTouched(true);
    const invalid = validatePhone(values.phone);
    setErrors((current) => ({ ...current, phone: invalid ?? "" }));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || submitting.current || !dirty) return;
    const invalid = validateProfilePatch(patch);
    setPhoneTouched(true);
    setErrors(invalid);
    setSuccess("");
    setError("");
    if (Object.keys(invalid).length) {
      setError("Vui lòng kiểm tra thông tin đã nhập.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      const saved = await accountService.updateProfile(patch);
      onSaved(saved);
      setValues(profileFormFromProfile(saved));
      setSuccess("Đã lưu thông tin tài khoản.");
      if (patch.displayName !== undefined) {
        // The header reads the session snapshot; refreshing it shows the new name.
        try {
          await api.refresh();
          router.refresh();
        } catch {
          // The profile is saved; the header catches up on the next session refresh.
        }
      }
    } catch (caught) {
      setErrors(
        caught instanceof ApiError ? accountFieldErrors(caught.errors) : {},
      );
      setError(getErrorMessage(caught));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  function reset() {
    setValues(profileFormFromProfile(profile));
    setErrors({});
    setError("");
    setSuccess("");
    setPhoneTouched(false);
  }
  return (
    <div className="stack">
      <PageHeading
        eyebrow="Tài khoản"
        title="Tài khoản của bạn"
        description="Cập nhật thông tin cá nhân và bảo vệ tài khoản ANGI của bạn."
      />
      {success && <Alert tone="success">{success}</Alert>}
      <div className="account-grid">
        <Card className="account-identity">
          <Avatar
            name={profile.displayName}
            image={profile.avatarUrl}
            className="avatar-xl"
          />
          <div className="stack-sm">
            <h2>{profile.displayName}</h2>
            <p className="helper">{profile.email}</p>
            <div className="actions">
              <Badge>{LABEL_BY_ROLE[profile.role]}</Badge>
              <Badge tone={profile.emailVerified ? "success" : "warning"}>
                {profile.emailVerified
                  ? "Đã xác minh email"
                  : "Chưa xác minh email"}
              </Badge>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Thành viên từ</dt>
              <dd>{dateLabel(profile.createdAt)}</dd>
            </div>
            <div>
              <dt>Đăng nhập</dt>
              <dd>
                {[
                  profile.hasPassword ? "Email và mật khẩu" : null,
                  profile.linkedProviders.includes("google") ? "Google" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Chưa có phương thức đăng nhập"}
              </dd>
            </div>
          </dl>
          <Button variant="secondary" onClick={() => setPasswordOpen(true)}>
            {profile.hasPassword ? "Đổi mật khẩu" : "Tạo mật khẩu"}
          </Button>
        </Card>
        <Card title="Thông tin cá nhân">
          {error && <Alert>{error}</Alert>}
          <form className="stack" noValidate onSubmit={save} aria-busy={saving}>
            <Field
              label="Tên hiển thị"
              name="displayName"
              value={values.displayName}
              onChange={(event) => change("displayName", event.target.value)}
              required
              minLength={DISPLAY_NAME_MIN}
              maxLength={DISPLAY_NAME_MAX}
              autoComplete="name"
              error={errors.displayName}
              helper={`Từ ${DISPLAY_NAME_MIN} đến ${DISPLAY_NAME_MAX} ký tự.`}
              disabled={saving}
            />
            <Field
              label="Email"
              value={profile.email}
              readOnly
              helper="Email đăng nhập, không thể thay đổi tại đây."
            />
            <Field
              label="Số điện thoại"
              name="phone"
              type="tel"
              inputMode="tel"
              value={values.phone}
              onChange={(event) => changePhone(event.target.value)}
              onBlur={blurPhone}
              maxLength={PHONE_MAX}
              autoComplete="tel"
              error={errors.phone}
              helper={`Số di động Việt Nam gồm ${PHONE_DIGITS} chữ số, bắt đầu bằng ${PHONE_PREFIXES.join(", ")}.`}
              disabled={saving}
            />
            <TextArea
              label="Giới thiệu"
              name="bio"
              value={values.bio}
              onChange={(event) => change("bio", event.target.value)}
              maxLength={BIO_MAX}
              error={errors.bio}
              helper="Không bắt buộc."
              disabled={saving}
            />
            <div className="actions">
              <Button type="submit" loading={saving} disabled={!dirty}>
                Lưu thay đổi
              </Button>
              <Button
                variant="secondary"
                disabled={!dirty || saving}
                onClick={() => setDiscardOpen(true)}
              >
                Hủy thay đổi
              </Button>
            </div>
          </form>
        </Card>
      </div>
      <ConfirmDialog
        open={discardOpen}
        title="Bỏ thay đổi chưa lưu?"
        destructive
        label="Bỏ thay đổi"
        cancelLabel="Tiếp tục chỉnh sửa"
        onClose={() => setDiscardOpen(false)}
        onConfirm={() => {
          reset();
          setDiscardOpen(false);
        }}
      >
        <p>Thông tin sẽ được khôi phục về lần lưu gần nhất.</p>
      </ConfirmDialog>
      <PasswordDialog
        open={passwordOpen}
        hasPassword={profile.hasPassword}
        onClose={() => setPasswordOpen(false)}
        onChanged={() => {
          setPasswordOpen(false);
          setSuccess(
            "Đã cập nhật mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.",
          );
        }}
      />
    </div>
  );
}

const emptyPassword: PasswordFormValues = {
  current: "",
  next: "",
  confirm: "",
};

function PasswordDialog({
  open,
  hasPassword,
  onClose,
  onChanged,
}: {
  open: boolean;
  hasPassword: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [values, setValues] = useState(emptyPassword);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  function update(key: keyof PasswordFormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [passwordField[key]]: "" }));
  }
  function close() {
    if (busy) return;
    setValues(emptyPassword);
    setErrors({});
    setError("");
    onClose();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submitting.current) return;
    const invalid = validatePasswordForm(values, hasPassword);
    setErrors(invalid);
    setError("");
    if (Object.keys(invalid).length) return;
    submitting.current = true;
    setBusy(true);
    try {
      await accountService.changePassword(
        buildPasswordRequest(values, hasPassword),
      );
      setValues(emptyPassword);
      setErrors({});
      onChanged();
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        caught.errorCode === "WRONG_CURRENT_PASSWORD"
      ) {
        setErrors({ currentPassword: "Mật khẩu hiện tại chưa đúng." });
      } else {
        setErrors(
          caught instanceof ApiError ? accountFieldErrors(caught.errors) : {},
        );
        setError(getErrorMessage(caught));
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onClose={close}
      title={hasPassword ? "Đổi mật khẩu" : "Tạo mật khẩu"}
      focusField
    >
      <form className="stack" noValidate onSubmit={submit} aria-busy={busy}>
        {error && <Alert>{error}</Alert>}
        {hasPassword && (
          <PasswordField
            label="Mật khẩu hiện tại"
            name="currentPassword"
            autoComplete="current-password"
            value={values.current}
            onChange={(event) => update("current", event.target.value)}
            required
            error={errors.currentPassword}
            disabled={busy}
          />
        )}
        <PasswordField
          label="Mật khẩu mới"
          name="newPassword"
          autoComplete="new-password"
          value={values.next}
          onChange={(event) => update("next", event.target.value)}
          required
          maxLength={PASSWORD_MAX}
          error={errors.newPassword}
          helper={`${PASSWORD_MIN}–${PASSWORD_MAX} ký tự, ít nhất một chữ cái và một chữ số.`}
          disabled={busy}
        />
        <PasswordField
          label="Nhập lại mật khẩu mới"
          name="confirmPassword"
          autoComplete="new-password"
          value={values.confirm}
          onChange={(event) => update("confirm", event.target.value)}
          required
          maxLength={PASSWORD_MAX}
          error={errors.confirm}
          disabled={busy}
        />
        <div className="actions">
          <Button type="submit" loading={busy}>
            Cập nhật mật khẩu
          </Button>
          <Button variant="secondary" disabled={busy} onClick={close}>
            Hủy
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

const passwordField: Record<keyof PasswordFormValues, string> = {
  current: "currentPassword",
  next: "newPassword",
  confirm: "confirm",
};
