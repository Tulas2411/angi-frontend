import { ApiError, getErrorMessage } from "@/shared/api/error";
import type {
  PermissionDto,
  PermissionEffect,
  PermissionOverrideDto,
} from "./permission-types";

/**
 * Permissions the backend never grants to a Mod (`AdministrationPermissionRules`: ADM-P3 and
 * ADM-P4 answer PERMISSION_NOT_GRANTABLE). They are shown, locked.
 */
export const adminOnlyPermissions: ReadonlySet<string> = new Set([
  "MOD_MANAGE",
  "SYSTEM_AUDIT_VIEW",
]);

export const isGrantable = (code: string) => !adminOnlyPermissions.has(code);

/** The groups the catalog is shown in, in this order; a code no group knows goes to "Khác". */
const permissionGroups: { key: string; title: string; match: RegExp }[] = [
  { key: "users", title: "Người dùng", match: /^USER_/ },
  {
    key: "restaurants",
    title: "Nhà hàng và thực đơn",
    match: /^(RESTAURANT_|MENU_)/,
  },
  { key: "reports", title: "Báo cáo vi phạm", match: /^REPORT_/ },
  {
    key: "content",
    title: "Nội dung cộng đồng",
    match: /^(BLOG_|REVIEW_)/,
  },
  {
    key: "system",
    title: "Quản trị hệ thống",
    match: /^(MOD_MANAGE|SYSTEM_|DASHBOARD_)/,
  },
];

export interface PermissionGroup {
  key: string;
  title: string;
  permissions: PermissionDto[];
}

/** The catalog of ADM-P1 split into groups, catalog order kept inside each group. */
export function groupPermissions(
  permissions: readonly PermissionDto[],
): PermissionGroup[] {
  const groups = permissionGroups.map((group) => ({
    key: group.key,
    title: group.title,
    permissions: permissions.filter((item) => group.match.test(item.code)),
  }));
  const known = new Set(
    groups.flatMap((group) => group.permissions.map((item) => item.code)),
  );
  const other = permissions.filter((item) => !known.has(item.code));
  return [
    ...groups,
    { key: "other", title: "Khác", permissions: other },
  ].filter((group) => group.permissions.length > 0);
}

/** The codes in catalog order, so a request and a comparison never depend on click order. */
export function inCatalogOrder(
  codes: Iterable<string>,
  permissions: readonly PermissionDto[],
) {
  const wanted = new Set(codes);
  return permissions
    .map((item) => item.code)
    .filter((code) => wanted.has(code));
}

/** Two code lists hold the same permissions (order does not matter). */
export function sameCodes(a: readonly string[], b: readonly string[]) {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((code) => right.has(code));
}

/** What saving the MOD defaults would add and remove, for the confirmation. */
export function codesDiff(before: readonly string[], after: readonly string[]) {
  const old = new Set(before);
  const next = new Set(after);
  return {
    added: after.filter((code) => !old.has(code)),
    removed: before.filter((code) => !next.has(code)),
  };
}

/** The choice for one permission of one Mod: the role default, or an override. */
export type OverrideChoice = "inherit" | PermissionEffect;

export function overrideChoice(
  overrides: readonly PermissionOverrideDto[],
  code: string,
): OverrideChoice {
  return (
    overrides.find((item) => item.permissionCode === code)?.effect ?? "inherit"
  );
}

/** The override list after one choice; "inherit" removes the override. */
export function withOverride(
  overrides: readonly PermissionOverrideDto[],
  code: string,
  choice: OverrideChoice,
): PermissionOverrideDto[] {
  const rest = overrides.filter((item) => item.permissionCode !== code);
  return choice === "inherit"
    ? rest
    : [...rest, { permissionCode: code, effect: choice }];
}

/**
 * The ADM-P3 body: one entry per permission (the BE rejects duplicates), in catalog order. An
 * override that matches today's default is kept: it still holds if the MOD defaults change.
 */
export function overridesBody(
  overrides: readonly PermissionOverrideDto[],
  permissions: readonly PermissionDto[],
): PermissionOverrideDto[] {
  const order = permissions.map((item) => item.code);
  const seen = new Set<string>();
  return overrides
    .filter((item) => {
      if (seen.has(item.permissionCode)) return false;
      seen.add(item.permissionCode);
      return true;
    })
    .sort(
      (a, b) =>
        order.indexOf(a.permissionCode) - order.indexOf(b.permissionCode),
    );
}

/** Same rule as the backend: effective = role defaults + allow − deny. */
export function effectivePermissions(
  roleDefaults: readonly string[],
  overrides: readonly PermissionOverrideDto[],
) {
  const result = new Set(roleDefaults);
  for (const item of overrides)
    if (item.effect === "allow") result.add(item.permissionCode);
    else result.delete(item.permissionCode);
  return result;
}

/** ADM-P1..ADM-P4 failures by `errorCode` (sheet "Mã lỗi"). */
export function permissionError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "MOD_NOT_FOUND")
    return "Không tìm thấy tài khoản Mod này. Có thể tài khoản đã bị xóa.";
  if (code === "PERMISSION_NOT_GRANTABLE")
    return "Có quyền chỉ dành cho quản trị viên nên không cấp được cho Mod.";
  if (code === "UNKNOWN_PERMISSION")
    return "Có mã quyền không còn trong danh mục. Hãy tải lại trang rồi thử lại.";
  if (code === "VALIDATION_FAILED")
    return "Danh sách quyền chưa hợp lệ (mỗi quyền chỉ được chọn một lần).";
  if (code === "FORBIDDEN") return "Chỉ quản trị viên được quản lý phân quyền.";
  return getErrorMessage(error);
}
