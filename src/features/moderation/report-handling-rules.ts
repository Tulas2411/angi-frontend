import { ApiError, getErrorMessage } from "@/shared/api/error";
import type {
  ReportReasonCode,
  ReportStatus,
  ReportTargetType,
  ResolutionAction,
} from "./moderation-types";

/** F-59 Handle Restaurant Report (and the blog queue of the same screens): MOD-RP1..MOD-RP4. */
export const reportStatusLabels: Record<ReportStatus, string> = {
  pending: "Chưa nhận",
  in_review: "Đang xử lý",
  resolved: "Đã giải quyết",
  dismissed: "Đã bác bỏ",
};

export const reportReasonLabels: Record<ReportReasonCode, string> = {
  wrong_info: "Sai thông tin",
  closed: "Đã đóng cửa",
  spam: "Spam",
  offensive: "Xúc phạm",
  hygiene: "Vệ sinh",
  scam: "Lừa đảo",
  other: "Khác",
};

export const reasonLabel = (code: string) =>
  reportReasonLabels[code as ReportReasonCode] ?? code;

export const reportTargetTabs: { value: ReportTargetType; label: string }[] = [
  { value: "restaurant", label: "Nhà hàng" },
  { value: "blog", label: "Bài viết" },
];

export const reportStatusTabs: { value: "" | ReportStatus; label: string }[] = [
  { value: "pending", label: "Chưa nhận" },
  { value: "in_review", label: "Đang xử lý" },
  { value: "resolved", label: "Đã giải quyết" },
  { value: "dismissed", label: "Đã bác bỏ" },
  { value: "", label: "Tất cả" },
];

export const reasonFilterOptions: {
  value: "" | ReportReasonCode;
  label: string;
}[] = [
  { value: "", label: "Mọi lý do" },
  ...(Object.keys(reportReasonLabels) as ReportReasonCode[]).map((code) => ({
    value: code,
    label: reportReasonLabels[code],
  })),
];

export const resolutionActionLabels: Record<ResolutionAction, string> = {
  none: "Chỉ ghi nhận, không xử lý thêm",
  hide_restaurant: "Ẩn nhà hàng",
  suspend_restaurant: "Đình chỉ nhà hàng",
  hide_blog: "Ẩn bài viết",
  remove_blog: "Gỡ bài viết",
  warn_user: "Cảnh cáo",
  suspend_user: "Tạm khóa tài khoản",
  ban_user: "Cấm tài khoản",
};

/**
 * The actions MOD-RP4 accepts for a target type (ACTION_NOT_ALLOWED_FOR_TARGET otherwise);
 * warn / suspend / ban apply to the restaurant owner or the blog author.
 */
export function resolutionActionsFor(
  targetType: ReportTargetType,
): { value: ResolutionAction; label: string }[] {
  const person = targetType === "restaurant" ? "chủ quán" : "tác giả";
  const own: ResolutionAction[] =
    targetType === "restaurant"
      ? ["hide_restaurant", "suspend_restaurant"]
      : ["hide_blog", "remove_blog"];
  return [
    { value: "none", label: resolutionActionLabels.none },
    ...own.map((value) => ({ value, label: resolutionActionLabels[value] })),
    { value: "warn_user", label: `Cảnh cáo ${person}` },
    { value: "suspend_user", label: `Tạm khóa tài khoản ${person}` },
    { value: "ban_user", label: `Cấm tài khoản ${person}` },
  ];
}

export const resolutionNoteMax = 1000;

export interface ResolveForm {
  outcome: "resolved" | "dismissed";
  action: ResolutionAction;
  note: string;
  /** `yyyy-mm-ddTHH:mm`, local time. */
  suspendUntil: string;
}

/** Field problems before MOD-RP4 is sent (same rules as ResolveReportRequestDtoValidator). */
export function resolveProblems(form: ResolveForm, now = Date.now()) {
  const problems: Partial<Record<"note" | "suspendUntil", string>> = {};
  if (form.note.trim().length > resolutionNoteMax)
    problems.note = `Ghi chú không được vượt quá ${resolutionNoteMax} ký tự.`;
  if (form.outcome === "resolved" && form.action === "suspend_user") {
    const until = Date.parse(form.suspendUntil);
    if (!form.suspendUntil || Number.isNaN(until))
      problems.suspendUntil = "Chọn thời điểm hết hạn tạm khóa.";
    else if (until <= now)
      problems.suspendUntil = "Thời điểm hết hạn tạm khóa phải ở tương lai.";
  }
  return problems;
}

/** A dismissed report never acts on its target, so its action is always `none`. */
export function resolveRequest(
  form: ResolveForm,
  applyToRelatedReports: boolean,
) {
  const action = form.outcome === "dismissed" ? "none" : form.action;
  return {
    outcome: form.outcome,
    resolutionAction: action,
    ...(form.note.trim() ? { resolutionNote: form.note.trim() } : {}),
    ...(action === "suspend_user"
      ? { suspendUntil: new Date(form.suspendUntil).toISOString() }
      : {}),
    applyToRelatedReports,
  };
}

/** Plain text of a blog excerpt (BlogDetail.excerpt may hold sanitized HTML). */
export const plainText = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** MOD-RP1..MOD-RP4 failures by `errorCode` (sheet "Mã lỗi"). */
export function reportHandlingError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "REPORT_NOT_FOUND") return "Không tìm thấy báo cáo này.";
  if (code === "REPORT_ALREADY_CLAIMED")
    return "Báo cáo này vừa được Mod khác nhận xử lý. Trang đã tải lại trạng thái mới nhất.";
  if (code === "REPORT_CLOSED")
    return "Báo cáo này đã được kết luận. Trang đã tải lại kết quả mới nhất.";
  if (code === "ACTION_NOT_ALLOWED_FOR_TARGET")
    return "Hành động này không áp dụng cho loại đối tượng bị báo cáo.";
  if (code === "RESTAURANT_NOT_FOUND")
    return "Nhà hàng bị báo cáo không còn tồn tại.";
  if (code === "BLOG_NOT_FOUND")
    return "Bài viết bị báo cáo không còn tồn tại.";
  if (code === "FORBIDDEN")
    return "Tài khoản của bạn chưa được cấp quyền cho thao tác này (xử lý báo cáo, tạm khóa hoặc cấm người dùng).";
  if (code === "VALIDATION_FAILED") {
    const first =
      error instanceof ApiError
        ? Object.values(error.errors ?? {}).flat()[0]
        : undefined;
    return first ?? "Thông tin kết luận chưa hợp lệ.";
  }
  return getErrorMessage(error);
}

/** Codes after which the shown report is stale and is read again. */
export const isStaleReportError = (error: unknown) =>
  error instanceof ApiError &&
  (error.errorCode === "REPORT_ALREADY_CLAIMED" ||
    error.errorCode === "REPORT_CLOSED");
