import { ApiError, getErrorMessage } from "@/shared/api/error";
import type {
  RestaurantModerationStatus,
  RestaurantVerificationStatus,
} from "./restaurant-moderation-types";

export const moderationStatusTabs: {
  value: "" | RestaurantModerationStatus;
  label: string;
}[] = [
  { value: "", label: "Tất cả" },
  { value: "visible", label: "Hiển thị" },
  { value: "hidden", label: "Bị ẩn" },
  { value: "suspended", label: "Bị đình chỉ" },
];

export const verificationFilterOptions: {
  value: "" | RestaurantVerificationStatus;
  label: string;
}[] = [
  { value: "", label: "Mọi trạng thái xác minh" },
  { value: "verified", label: "Đã xác minh" },
  { value: "pending", label: "Chờ xác minh" },
  { value: "unverified", label: "Chưa xác minh" },
  { value: "rejected", label: "Bị từ chối" },
];

export const operatingFilterOptions = [
  { value: "", label: "Mọi trạng thái hoạt động" },
  { value: "open", label: "Đang hoạt động" },
  { value: "temporarily_closed", label: "Tạm đóng" },
  { value: "permanently_closed", label: "Đóng cửa vĩnh viễn" },
] as const;

export const moderationTone = {
  visible: "success",
  hidden: "warning",
  suspended: "error",
} as const;

export const verificationTone = {
  verified: "success",
  pending: "warning",
  unverified: "neutral",
  rejected: "error",
} as const;

export const operatingTone = {
  open: "success",
  temporarily_closed: "warning",
  permanently_closed: "error",
} as const;

/** What each MOD-R3 choice does, in the words the Mod reads before saving. */
export const moderationChoices: {
  value: RestaurantModerationStatus;
  label: string;
  hint: string;
}[] = [
  {
    value: "visible",
    label: "Hiển thị",
    hint: "Quán xuất hiện lại trong tìm kiếm, gợi ý và lịch trình.",
  },
  {
    value: "hidden",
    label: "Ẩn quán",
    hint: "Quán không còn hiện với khách; chủ quán vẫn đăng nhập và sửa hồ sơ.",
  },
  {
    value: "suspended",
    label: "Đình chỉ",
    hint: "Vi phạm nặng: quán bị gỡ khỏi mọi nơi khách nhìn thấy cho tới khi mở lại.",
  },
];

/** BE limit of `reason` (MOD-R3 / MOD-R4 validators). */
export const reasonMax = 1000;

/** The reason is required (1..1000) for MOD-R3 and MOD-R4. */
export function reasonProblem(reason: string) {
  const text = reason.trim();
  if (!text) return "Ghi lý do để chủ quán và các Mod khác biết vì sao.";
  if (text.length > reasonMax)
    return `Lý do không được vượt quá ${reasonMax} ký tự.`;
  return "";
}

/** Vietnamese labels of the `audit_logs.action` values a restaurant's history shows. */
const auditLabels: Record<string, string> = {
  RESTAURANT_UPDATED: "Cập nhật hồ sơ quán",
  RESTAURANT_OPERATING_STATUS_CHANGED: "Đổi trạng thái hoạt động",
  RESTAURANT_HIDDEN: "Ẩn quán",
  RESTAURANT_SUSPENDED: "Đình chỉ quán",
  RESTAURANT_SHOWN: "Hiển thị lại quán",
  RESTAURANT_VERIFIED: "Xác minh quán",
  RESTAURANT_VERIFICATION_REJECTED: "Từ chối hồ sơ xác minh",
  MENU_APPROVED: "Duyệt thực đơn",
  MENU_REJECTED: "Từ chối thực đơn",
  REPORT_RESOLVED: "Xử lý báo cáo",
  USER_WARNED: "Cảnh cáo chủ quán",
  USER_SUSPENDED: "Tạm khóa chủ quán",
  USER_BANNED: "Cấm chủ quán",
  USER_UNBANNED: "Gỡ cấm chủ quán",
  REVIEW_HIDDEN: "Ẩn đánh giá",
  REVIEW_REMOVED: "Gỡ đánh giá",
  REVIEW_RESTORED: "Khôi phục đánh giá",
};

export const auditLabel = (action: string) => auditLabels[action] ?? action;

export const isOpenReport = (status: string) =>
  status === "pending" || status === "in_review";

/** MOD-R1..MOD-R4 and MOD-RP4 failures by `errorCode` (sheet "Mã lỗi"). */
export function restaurantModerationError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "RESTAURANT_NOT_FOUND") return "Không tìm thấy nhà hàng này.";
  if (code === "DISH_NOT_FOUND") return "Không tìm thấy món ăn này.";
  if (code === "DISH_REMOVED")
    return "Món này đã bị gỡ khỏi thực đơn qua duyệt thực đơn, không hiển thị lại được.";
  if (code === "REPORT_NOT_FOUND") return "Không tìm thấy báo cáo này.";
  if (code === "REPORT_CLOSED")
    return "Báo cáo này đã được xử lý. Trang đã tải lại kết quả mới nhất.";
  if (code === "ACTION_NOT_ALLOWED_FOR_TARGET")
    return "Hành động này không áp dụng cho báo cáo nhà hàng.";
  if (code === "VALIDATION_FAILED") {
    const first =
      error instanceof ApiError
        ? Object.values(error.errors ?? {}).flat()[0]
        : undefined;
    return (
      first ?? "Thông tin chưa hợp lệ: lý do là bắt buộc, tối đa 1000 ký tự."
    );
  }
  if (code === "FORBIDDEN")
    return "Tài khoản của bạn chưa được cấp quyền kiểm duyệt nhà hàng.";
  return getErrorMessage(error);
}
