import { ApiError, getErrorMessage } from "@/shared/api/error";
import type {
  AuditActorRole,
  AuditLogDetailDto,
  AuditLogsQuery,
} from "./audit-types";

/** ADM-A1 page size (BE allows 1..100, default 20). */
export const auditPageSize = 20;

export type AuditTone = "neutral" | "success" | "warning" | "error";

interface ActionInfo {
  label: string;
  group: string;
  tone: AuditTone;
}

/**
 * Every `audit_logs.action` of API Design v1.8 (sheet Enum), the same list the ADM-A1 validator
 * accepts (BE `AuditActions.All`), in the sheet's order and grouped as the sheet groups them.
 */
export const auditActions: Record<string, ActionInfo> = {
  USER_REGISTERED: {
    label: "Đăng ký tài khoản",
    group: "Tài khoản",
    tone: "neutral",
  },
  USER_LOGIN: { label: "Đăng nhập", group: "Tài khoản", tone: "neutral" },
  PASSWORD_RESET: {
    label: "Đặt lại mật khẩu",
    group: "Tài khoản",
    tone: "neutral",
  },
  PROFILE_UPDATED: {
    label: "Cập nhật hồ sơ",
    group: "Tài khoản",
    tone: "neutral",
  },
  PASSWORD_CHANGED: {
    label: "Đổi mật khẩu",
    group: "Tài khoản",
    tone: "neutral",
  },
  RESTAURANT_UPDATED: {
    label: "Cập nhật nhà hàng",
    group: "Chủ quán",
    tone: "neutral",
  },
  RESTAURANT_OPERATING_STATUS_CHANGED: {
    label: "Đổi trạng thái hoạt động",
    group: "Chủ quán",
    tone: "neutral",
  },
  USER_WARNED: {
    label: "Cảnh cáo người dùng",
    group: "Kiểm duyệt người dùng",
    tone: "warning",
  },
  USER_SUSPENDED: {
    label: "Tạm khóa người dùng",
    group: "Kiểm duyệt người dùng",
    tone: "error",
  },
  USER_BANNED: {
    label: "Cấm người dùng",
    group: "Kiểm duyệt người dùng",
    tone: "error",
  },
  USER_UNBANNED: {
    label: "Gỡ cấm người dùng",
    group: "Kiểm duyệt người dùng",
    tone: "success",
  },
  RESTAURANT_HIDDEN: {
    label: "Ẩn nhà hàng",
    group: "Kiểm duyệt nhà hàng",
    tone: "warning",
  },
  RESTAURANT_SUSPENDED: {
    label: "Đình chỉ nhà hàng",
    group: "Kiểm duyệt nhà hàng",
    tone: "error",
  },
  RESTAURANT_SHOWN: {
    label: "Hiện lại nhà hàng",
    group: "Kiểm duyệt nhà hàng",
    tone: "success",
  },
  RESTAURANT_VERIFIED: {
    label: "Xác minh nhà hàng",
    group: "Kiểm duyệt nhà hàng",
    tone: "success",
  },
  RESTAURANT_VERIFICATION_REJECTED: {
    label: "Từ chối xác minh",
    group: "Kiểm duyệt nhà hàng",
    tone: "error",
  },
  MENU_APPROVED: {
    label: "Duyệt thực đơn",
    group: "Kiểm duyệt nhà hàng",
    tone: "success",
  },
  MENU_REJECTED: {
    label: "Từ chối thực đơn",
    group: "Kiểm duyệt nhà hàng",
    tone: "error",
  },
  REPORT_RESOLVED: {
    label: "Xử lý báo cáo",
    group: "Kiểm duyệt nhà hàng",
    tone: "success",
  },
  BLOG_HIDDEN: {
    label: "Ẩn bài viết",
    group: "Kiểm duyệt nội dung",
    tone: "warning",
  },
  BLOG_REMOVED: {
    label: "Gỡ bài viết",
    group: "Kiểm duyệt nội dung",
    tone: "error",
  },
  BLOG_RESTORED: {
    label: "Khôi phục bài viết",
    group: "Kiểm duyệt nội dung",
    tone: "success",
  },
  COMMENT_HIDDEN: {
    label: "Ẩn bình luận",
    group: "Kiểm duyệt nội dung",
    tone: "warning",
  },
  COMMENT_REMOVED: {
    label: "Gỡ bình luận",
    group: "Kiểm duyệt nội dung",
    tone: "error",
  },
  COMMENT_RESTORED: {
    label: "Khôi phục bình luận",
    group: "Kiểm duyệt nội dung",
    tone: "success",
  },
  REVIEW_HIDDEN: {
    label: "Ẩn đánh giá",
    group: "Kiểm duyệt nội dung",
    tone: "warning",
  },
  REVIEW_REMOVED: {
    label: "Gỡ đánh giá",
    group: "Kiểm duyệt nội dung",
    tone: "error",
  },
  REVIEW_RESTORED: {
    label: "Khôi phục đánh giá",
    group: "Kiểm duyệt nội dung",
    tone: "success",
  },
  REVIEW_REPLY_HIDDEN: {
    label: "Ẩn phản hồi",
    group: "Kiểm duyệt nội dung",
    tone: "warning",
  },
  REVIEW_REPLY_REMOVED: {
    label: "Gỡ phản hồi",
    group: "Kiểm duyệt nội dung",
    tone: "error",
  },
  REVIEW_REPLY_RESTORED: {
    label: "Khôi phục phản hồi",
    group: "Kiểm duyệt nội dung",
    tone: "success",
  },
  MOD_CREATED: {
    label: "Tạo tài khoản Mod",
    group: "Quản trị",
    tone: "neutral",
  },
  MOD_UPDATED: { label: "Cập nhật Mod", group: "Quản trị", tone: "neutral" },
  MOD_PERMISSIONS_CHANGED: {
    label: "Đổi quyền của Mod",
    group: "Quản trị",
    tone: "warning",
  },
  ROLE_PERMISSIONS_CHANGED: {
    label: "Đổi quyền mặc định",
    group: "Quản trị",
    tone: "warning",
  },
};

export const auditActionLabel = (action: string) =>
  auditActions[action]?.label ?? action;
export const auditActionTone = (action: string): AuditTone =>
  auditActions[action]?.tone ?? "neutral";

/** `audit_logs.entity_type` values of API Design v1.8 (sheet Enum, BE `AuditEntityTypes.All`). */
export const auditEntityTypes: Record<string, string> = {
  user: "Người dùng",
  restaurant: "Nhà hàng",
  menu_submission: "Bản thực đơn",
  report: "Báo cáo",
  blog: "Bài viết",
  blog_comment: "Bình luận",
  review: "Đánh giá",
  review_reply: "Phản hồi đánh giá",
  role: "Vai trò",
};

export const auditRoles: Record<AuditActorRole, string> = {
  TRAVELER: "Người dùng",
  RESTAURANT_OWNER: "Chủ quán",
  MOD: "Mod",
  ADMIN: "Admin",
};

/** "Người dùng #12", "Vai trò #3"; null when the row names no entity. */
export function auditEntityLabel(type: string | null, id: number | null) {
  if (!type) return null;
  const name = auditEntityTypes[type] ?? type;
  return id === null ? name : `${name} #${id}`;
}

/** The action filter: "Tất cả", then each action under its group, in the sheet's order. */
export function auditActionOptions() {
  return [
    { value: "", label: "Tất cả hành động" },
    ...Object.entries(auditActions).map(([value, info]) => ({
      value,
      label: `${info.group} · ${info.label}`,
    })),
  ];
}

/** The filters a person sets on the screen; dates are `YYYY-MM-DD` in Vietnam time. */
export interface AuditFilters {
  action: string;
  actorRole: "" | AuditActorRole;
  entityType: string;
  fromDate: string;
  toDate: string;
  actorId: string;
  subjectUserId: string;
  entityId: string;
}

export const emptyAuditFilters: AuditFilters = {
  action: "",
  actorRole: "",
  entityType: "",
  fromDate: "",
  toDate: "",
  actorId: "",
  subjectUserId: "",
  entityId: "",
};

const positiveId = /^[1-9]\d{0,17}$/;

/** A positive id typed in a filter box, or undefined while it is empty or not a number. */
export function auditIdFilter(value: string): number | undefined {
  const trimmed = value.trim();
  return positiveId.test(trimmed) ? Number(trimmed) : undefined;
}

/** Problems with the typed filters, keyed by field; empty when the query can be sent. */
export function auditFilterProblems(filters: AuditFilters) {
  const problems: Partial<Record<keyof AuditFilters, string>> = {};
  for (const key of ["actorId", "subjectUserId", "entityId"] as const)
    if (filters[key].trim() && auditIdFilter(filters[key]) === undefined)
      problems[key] = "Nhập một số nguyên dương.";
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate)
    problems.toDate = "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.";
  return problems;
}

/**
 * The ADM-A1 query for the filters. A day is a whole day in Vietnam: `from` starts at 00:00 and
 * `to` ends at 23:59:59 (+07:00), so the BE compares the right instants whatever its time zone.
 */
export function auditQuery(
  filters: AuditFilters,
  page: number,
  pageSize = auditPageSize,
): AuditLogsQuery {
  return {
    action: filters.action || undefined,
    actorRole: filters.actorRole || undefined,
    entityType: filters.entityType || undefined,
    from: filters.fromDate ? `${filters.fromDate}T00:00:00+07:00` : undefined,
    to: filters.toDate ? `${filters.toDate}T23:59:59+07:00` : undefined,
    actorId: auditIdFilter(filters.actorId),
    subjectUserId: auditIdFilter(filters.subjectUserId),
    entityId: auditIdFilter(filters.entityId),
    page,
    pageSize,
  };
}

/** `?action=…&page=1&pageSize=20`, leaving out every filter that is not set. */
export function auditQueryString(query: AuditLogsQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== "") params.set(key, String(value));
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** How many of the filters are set (shown on the "Lọc nâng cao" toggle and the reset button). */
export function activeAuditFilters(filters: AuditFilters) {
  return Object.values(filters).filter((value) => value.trim() !== "").length;
}

export function auditDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

/** "Hôm nay", "Hôm qua" or the date, for grouping rows by the day they happened (Vietnam time). */
export function auditDay(value: string, now = new Date()) {
  const day = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(date);
  const key = day(new Date(value));
  const today = day(now);
  const yesterday = day(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (key === today) return { key, label: "Hôm nay" };
  if (key === yesterday) return { key, label: "Hôm qua" };
  const [y, m, d] = key.split("-");
  return { key, label: `${d}/${m}/${y}` };
}

export function auditTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

/** Names of the snake_case columns the BE writes into old_values / new_values. */
const fieldLabels: Record<string, string> = {
  status: "Trạng thái",
  reason: "Lý do",
  review_note: "Ghi chú kiểm duyệt",
  reviewed_at: "Thời điểm duyệt",
  reviewed_by: "Người duyệt (mã)",
  suspended_until: "Khóa đến",
  display_name: "Tên hiển thị",
  email: "Email",
  phone: "Số điện thoại",
  bio: "Giới thiệu",
  avatar_media_id: "Ảnh đại diện (mã)",
  permission_codes: "Quyền",
  permissions: "Quyền",
  overrides: "Quyền riêng",
  role: "Vai trò",
  name: "Tên",
  description: "Mô tả",
  address_line: "Địa chỉ",
  ward: "Phường / xã",
  province_code: "Tỉnh / thành (mã)",
  operating_status: "Trạng thái hoạt động",
  verification_status: "Trạng thái xác minh",
  moderation_status: "Trạng thái hiển thị",
  resolution: "Cách xử lý",
  handled_by: "Người xử lý (mã)",
  cover_media_id: "Ảnh bìa (mã)",
  latitude: "Vĩ độ",
  longitude: "Kinh độ",
};

export function auditFieldLabel(key: string) {
  return fieldLabels[key] ?? key.replaceAll("_", " ");
}

/** Vietnamese names of the snake_case enum values the BE stores (fallback: the raw value). */
const valueLabels: Record<string, string> = {
  active: "Đang hoạt động",
  pending_verification: "Chờ xác minh email",
  suspended: "Tạm khóa",
  banned: "Bị cấm",
  deactivated: "Đã vô hiệu hóa",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
  cancelled: "Đã hủy",
  draft: "Bản nháp",
  needs_more_info: "Cần bổ sung",
  verified: "Đã xác minh",
  unverified: "Chưa xác minh",
  visible: "Hiển thị",
  hidden: "Bị ẩn",
  removed: "Đã gỡ",
  open: "Đang mở cửa",
  temporarily_closed: "Tạm đóng cửa",
  permanently_closed: "Đóng cửa hẳn",
  in_review: "Đang xử lý",
  resolved: "Đã xử lý",
  dismissed: "Bỏ qua",
};

const isoInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** One value of old_values / new_values as text: dates in Vietnam time, enums in Vietnamese. */
export function auditValueText(value: unknown): string {
  if (value === null || value === undefined) return "Trống";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") return value.toLocaleString("vi-VN");
  if (typeof value === "string") {
    if (isoInstant.test(value)) return auditDateTime(value);
    return valueLabels[value] ?? (value === "" ? "Trống" : value);
  }
  if (Array.isArray(value))
    return value.length ? value.map(auditValueText).join(", ") : "Trống";
  return JSON.stringify(value);
}

/** One changed column: its value before and after, and for lists what was added and removed. */
export interface AuditChange {
  key: string;
  label: string;
  before: unknown;
  after: unknown;
  /** Only for lists of strings (e.g. permission codes). */
  added?: string[];
  removed?: string[];
}

const stringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/**
 * The columns a row changed, in the order the BE wrote them (new values first, then columns
 * that only had an old value). `reason` is left out: the screen shows it as its own block.
 */
export function auditChanges(
  detail: Pick<AuditLogDetailDto, "oldValues" | "newValues">,
): AuditChange[] {
  const before = isRecord(detail.oldValues) ? detail.oldValues : {};
  const after = isRecord(detail.newValues) ? detail.newValues : {};
  const keys = [
    ...new Set([...Object.keys(after), ...Object.keys(before)]),
  ].filter((key) => key !== "reason");
  return keys.map((key) => {
    const change: AuditChange = {
      key,
      label: auditFieldLabel(key),
      before: before[key],
      after: after[key],
    };
    if (stringList(before[key]) || stringList(after[key])) {
      const old = stringList(before[key]) ? before[key] : [];
      const next = stringList(after[key]) ? after[key] : [];
      change.added = next.filter((item) => !old.includes(item));
      change.removed = old.filter((item) => !next.includes(item));
    }
    return change;
  });
}

/** The Mod's or Admin's reason, which the BE keeps in `new_values.reason`. */
export function auditReason(
  detail: Pick<AuditLogDetailDto, "newValues">,
): string | null {
  const reason = isRecord(detail.newValues) ? detail.newValues.reason : null;
  return typeof reason === "string" && reason.trim() ? reason : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A short name for a user agent ("Chrome trên Windows"); the raw text stays in a tooltip. */
export function auditAgent(agent: string | null) {
  if (!agent) return "Không ghi nhận";
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /OPR\//.test(agent)
      ? "Opera"
      : /Chrome\//.test(agent)
        ? "Chrome"
        : /Firefox\//.test(agent)
          ? "Firefox"
          : /Safari\//.test(agent)
            ? "Safari"
            : null;
  const system = /Windows/.test(agent)
    ? "Windows"
    : /Android/.test(agent)
      ? "Android"
      : /iPhone|iPad|iOS/.test(agent)
        ? "iOS"
        : /Mac OS X|Macintosh/.test(agent)
          ? "macOS"
          : /Linux/.test(agent)
            ? "Linux"
            : null;
  if (browser && system) return `${browser} trên ${system}`;
  return browser ?? system ?? agent;
}

export function auditError(error: unknown) {
  if (error instanceof ApiError && error.errorCode === "AUDIT_LOG_NOT_FOUND")
    return "Không tìm thấy bản ghi nhật ký này.";
  if (error instanceof ApiError && error.status === 403)
    return "Chỉ quản trị viên được xem nhật ký hệ thống.";
  return getErrorMessage(error);
}
