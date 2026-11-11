import { ApiError, getErrorMessage } from "@/shared/api/error";
import type { CreateModRequestDto } from "./mod-types";
import type { PermissionOverrideDto } from "./permission-types";

export const modStatusLabels: Record<string, string> = {
  active: "Đang hoạt động",
  deactivated: "Đã vô hiệu hóa",
  pending_verification: "Chờ xác minh",
  suspended: "Tạm đình chỉ",
  banned: "Bị cấm",
};

export const modStatusTone = (
  status: string,
): "success" | "warning" | "neutral" | "error" =>
  status === "active"
    ? "success"
    : status === "deactivated"
      ? "neutral"
      : status === "banned"
        ? "error"
        : "warning";

/** Length in characters as the BE counts it (Unicode code points, after trimming). */
export const nameLength = (name: string) => [...name.trim()].length;

/** Same shape the BE `EmailAddress()` accepts in practice: one @, something on both sides. */
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ModForm {
  email: string;
  displayName: string;
}

/** CreateModRequestDtoValidator rules, checked before sending (the BE stays authoritative). */
export function validateModForm(form: ModForm): Record<string, string> {
  const errors: Record<string, string> = {};
  const email = form.email.trim();
  if (!email) errors.email = "Nhập email của Mod.";
  else if (email.length > 255)
    errors.email = "Email không được vượt quá 255 ký tự.";
  else if (!emailPattern.test(email))
    errors.email = "Email chưa đúng định dạng, ví dụ: linh.mod@angi.vn.";
  const nameError = displayNameProblem(form.displayName);
  if (nameError) errors.displayName = nameError;
  return errors;
}

/** UpdateModRequestDtoValidator / CreateModRequestDtoValidator: 2..100 characters. */
export function displayNameProblem(displayName: string) {
  const length = nameLength(displayName);
  if (length === 0) return "Nhập tên hiển thị của Mod.";
  if (length < 2) return "Tên hiển thị cần ít nhất 2 ký tự.";
  if (length > 100) return "Tên hiển thị không được vượt quá 100 ký tự.";
  return "";
}

/** ADM-M2 body: trimmed values; overrides only when some were chosen. */
export function createModBody(
  form: ModForm,
  overrides: readonly PermissionOverrideDto[],
): CreateModRequestDto {
  return {
    email: form.email.trim(),
    displayName: form.displayName.trim(),
    ...(overrides.length ? { permissionOverrides: [...overrides] } : {}),
  };
}

/** BE field errors (`errors`, keyed by property) mapped to the form fields. */
export function modFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  if (error.errorCode === "EMAIL_ALREADY_EXISTS")
    return { email: "Email này đã có tài khoản ANGI. Hãy dùng email khác." };
  const result: Record<string, string> = {};
  for (const [key, messages] of Object.entries(error.errors ?? {})) {
    const field = key.toLowerCase();
    if (field === "email" && messages[0]) result.email = messages[0];
    if (field === "displayname" && messages[0])
      result.displayName = messages[0];
  }
  return result;
}

/** ADM-M1..ADM-M4 failures by `errorCode` (sheet "Mã lỗi"). */
export function modError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "MOD_NOT_FOUND")
    return "Không tìm thấy tài khoản Mod này. Có thể tài khoản đã bị xóa.";
  if (code === "EMAIL_ALREADY_EXISTS") return "Email này đã có tài khoản ANGI.";
  if (code === "UNKNOWN_PERMISSION")
    return "Có quyền không hợp lệ cho tài khoản Mod (quyền không còn hoặc chỉ dành cho quản trị viên).";
  if (code === "VALIDATION_FAILED")
    return "Thông tin chưa hợp lệ. Kiểm tra lại các ô được đánh dấu.";
  if (code === "FORBIDDEN") return "Chỉ quản trị viên được quản lý Mod.";
  return getErrorMessage(error);
}

/** "02/11/2026, 19:30" in Vietnam time; "Chưa đăng nhập" for an account never used. */
export function modDateTime(value: string | null, empty = "Chưa đăng nhập") {
  if (!value) return empty;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Bangkok",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
