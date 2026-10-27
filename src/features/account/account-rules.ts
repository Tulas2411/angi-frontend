import type {
  ChangePasswordRequestDto,
  ProfileFormValues,
  UpdateProfileRequestDto,
  UserProfileDto,
} from "./account-types";

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 100;
export const PHONE_MAX = 20;
export const BIO_MAX = 500;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;

/** A Vietnamese mobile number has exactly ten digits. */
export const PHONE_DIGITS = 10;
/** Mobile prefixes in use in Vietnam (03, 05, 07, 08, 09). */
export const PHONE_PREFIXES = ["03", "05", "07", "08", "09"] as const;
/** Characters a user may type: digits plus the usual separators. */
const PHONE_ALLOWED = /^[0-9+\-().\s]*$/;
const PHONE_SEPARATORS = /[\s\-().]/g;

/**
 * Strips the separators a user may type and turns an international
 * `+84`/`84` prefix into the local `0` prefix.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const compact = trimmed.replace(PHONE_SEPARATORS, "");
  const withoutPlus = compact.replace(/^\+/, "");
  return withoutPlus.startsWith("84")
    ? `0${withoutPlus.slice(2)}`
    : withoutPlus;
}

/**
 * Returns a Vietnamese message for an invalid phone number, or `null` when the
 * value is empty (the field is optional) or already a valid mobile number.
 */
export function validatePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const invalid = "Số điện thoại chỉ gồm chữ số và các ký tự phân tách (+, -, ., ngoặc, khoảng trắng).";
  if (!PHONE_ALLOWED.test(trimmed)) return invalid;
  const digits = normalizePhone(trimmed);
  if (!/^\d+$/.test(digits)) return invalid;
  if (digits.length !== PHONE_DIGITS)
    return `Số điện thoại phải gồm đúng ${PHONE_DIGITS} chữ số.`;
  if (!PHONE_PREFIXES.some((prefix) => digits.startsWith(prefix)))
    return `Số điện thoại phải bắt đầu bằng ${PHONE_PREFIXES.join(", ")}.`;
  return null;
}

export function profileFormFromProfile(
  profile: Pick<UserProfileDto, "displayName" | "phone" | "bio">,
): ProfileFormValues {
  return {
    displayName: profile.displayName,
    phone: profile.phone ?? "",
    bio: profile.bio ?? "",
  };
}

/** Only changed fields are sent; clearing phone or bio sends an explicit null (ME-02). */
export function buildProfilePatch(
  values: ProfileFormValues,
  original: Pick<UserProfileDto, "displayName" | "phone" | "bio">,
): UpdateProfileRequestDto {
  const patch: UpdateProfileRequestDto = {};
  const displayName = values.displayName.trim();
  if (displayName !== original.displayName) patch.displayName = displayName;
  // Separators are removed before the comparison so retyping the same number
  // in another format is not sent as a change.
  const phone = normalizePhone(values.phone) || null;
  if (phone !== (normalizePhone(original.phone ?? "") || null))
    patch.phone = phone;
  const bio = values.bio.trim() || null;
  if (bio !== (original.bio?.trim() || null)) patch.bio = bio;
  return patch;
}

export function validateProfilePatch(
  patch: UpdateProfileRequestDto,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (patch.displayName !== undefined) {
    const length = [...patch.displayName].length;
    if (length < DISPLAY_NAME_MIN || length > DISPLAY_NAME_MAX)
      errors.displayName = `Tên hiển thị phải từ ${DISPLAY_NAME_MIN} đến ${DISPLAY_NAME_MAX} ký tự.`;
  }
  if (patch.phone !== undefined && patch.phone !== null) {
    const invalid = validatePhone(patch.phone);
    if (invalid) errors.phone = invalid;
    else if (patch.phone.length > PHONE_MAX)
      errors.phone = `Số điện thoại không được vượt quá ${PHONE_MAX} ký tự.`;
  }
  if (patch.bio && patch.bio.length > BIO_MAX)
    errors.bio = `Giới thiệu không được vượt quá ${BIO_MAX} ký tự.`;
  return errors;
}

export interface PasswordFormValues {
  current: string;
  next: string;
  confirm: string;
}

export function validatePasswordForm(
  values: PasswordFormValues,
  hasPassword: boolean,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (hasPassword && !values.current)
    errors.currentPassword = "Nhập mật khẩu hiện tại.";
  const next = values.next;
  if (!next) errors.newPassword = "Nhập mật khẩu mới.";
  else if (next.length < PASSWORD_MIN || next.length > PASSWORD_MAX)
    errors.newPassword = `Mật khẩu mới phải từ ${PASSWORD_MIN} đến ${PASSWORD_MAX} ký tự.`;
  else if (!/[A-Za-z]/.test(next) || !/[0-9]/.test(next))
    errors.newPassword =
      "Mật khẩu mới cần có ít nhất một chữ cái và một chữ số.";
  else if (hasPassword && next === values.current)
    errors.newPassword = "Mật khẩu mới phải khác mật khẩu hiện tại.";
  if (!errors.newPassword && values.confirm !== next)
    errors.confirm = "Mật khẩu xác nhận chưa trùng khớp.";
  return errors;
}

export function buildPasswordRequest(
  values: PasswordFormValues,
  hasPassword: boolean,
): ChangePasswordRequestDto {
  return hasPassword
    ? { currentPassword: values.current, newPassword: values.next }
    : { newPassword: values.next };
}

/** Maps the camelCase/PascalCase keys of VALIDATION_FAILED onto this form's field names. */
export function accountFieldErrors(
  errors?: Record<string, string[]>,
): Record<string, string> {
  const names: Record<string, string> = {
    displayname: "displayName",
    phone: "phone",
    bio: "bio",
    currentpassword: "currentPassword",
    newpassword: "newPassword",
  };
  return Object.fromEntries(
    Object.entries(errors ?? {}).map(([key, messages]) => [
      names[key.toLowerCase()] ?? key,
      messages.join(" "),
    ]),
  );
}
