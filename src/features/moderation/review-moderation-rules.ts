import { ApiError, getErrorMessage } from "@/shared/api/error";
import type { ContentStatus } from "./review-moderation-types";

export const reviewStatusTabs: { value: "" | ContentStatus; label: string }[] =
  [
    { value: "visible", label: "Đang hiển thị" },
    { value: "hidden", label: "Bị ẩn" },
    { value: "removed", label: "Đã gỡ" },
    { value: "", label: "Tất cả" },
  ];

export const ratingFilterOptions = [
  { value: "", label: "Mọi số sao" },
  { value: "1", label: "1 sao" },
  { value: "2", label: "2 sao" },
  { value: "3", label: "3 sao" },
  { value: "4", label: "4 sao" },
  { value: "5", label: "5 sao" },
];

export const contentStatusLabels: Record<ContentStatus, string> = {
  visible: "Đang hiển thị",
  hidden: "Bị ẩn",
  removed: "Đã gỡ",
};

export const contentStatusTone = {
  visible: "success",
  hidden: "warning",
  removed: "error",
} as const;

export type ModerationTarget = "review" | "reply";

/** The moves a moderator can make from a status: never to the status it already has. */
export function nextStatuses(current: ContentStatus): ContentStatus[] {
  return (["visible", "hidden", "removed"] as const).filter(
    (status) => status !== current,
  );
}

export const actionLabels: Record<ContentStatus, string> = {
  visible: "Hiện lại",
  hidden: "Ẩn",
  removed: "Gỡ",
};

/** What a move does, in the words the moderator reads before confirming. */
export function actionEffect(target: ModerationTarget, status: ContentStatus) {
  if (target === "review") {
    if (status === "visible")
      return "Đánh giá hiện lại trên trang quán và được tính lại vào điểm đánh giá.";
    if (status === "hidden")
      return "Đánh giá tạm ẩn khỏi trang quán và không còn tính vào điểm đánh giá. Có thể hiện lại sau.";
    return "Đánh giá bị gỡ vì vi phạm: không hiện công khai và không tính vào điểm đánh giá.";
  }
  if (status === "visible")
    return "Phản hồi của chủ quán hiện lại dưới đánh giá.";
  if (status === "hidden")
    return "Phản hồi của chủ quán tạm ẩn khỏi trang quán. Có thể hiện lại sau.";
  return "Phản hồi của chủ quán bị gỡ vì vi phạm và không hiện công khai.";
}

/** BE limit of `reason` (UpdateReviewStatus / UpdateReviewReplyStatus validators). */
export const reasonMax = 1000;

export function reasonProblem(reason: string) {
  const text = reason.trim();
  if (!text) return "Ghi lý do để người viết biết vì sao nội dung bị xử lý.";
  if (text.length > reasonMax)
    return `Lý do không được vượt quá ${reasonMax} ký tự.`;
  return "";
}

/** MOD-F1..MOD-F3 failures by `errorCode` (sheet "Mã lỗi"). */
export function reviewModerationError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "REVIEW_NOT_FOUND") return "Không tìm thấy đánh giá này.";
  if (code === "REPLY_NOT_FOUND")
    return "Đánh giá này chưa có phản hồi của chủ quán.";
  if (code === "FORBIDDEN")
    return "Tài khoản của bạn chưa được cấp quyền kiểm duyệt đánh giá.";
  if (code === "VALIDATION_FAILED") {
    const first =
      error instanceof ApiError
        ? Object.values(error.errors ?? {}).flat()[0]
        : undefined;
    return first ?? (error instanceof ApiError ? error.message : "") ?? "";
  }
  return getErrorMessage(error);
}
