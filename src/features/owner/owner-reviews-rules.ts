import { ApiError, getErrorMessage } from "@/shared/api/error";
import type {
  OwnerReviewCounts,
  OwnerReviewsQuery,
  ReplyReviewRequestDto,
  ReviewReplyDto,
} from "./owner-reviews-types";

/** OWN-20 accepts at most 1000 characters. */
export const REPLY_MAX_LENGTH = 1000;

/** Filter of the reply state. `all` sends no `replied` parameter at all. */
export type OwnerReplyFilter = "all" | "answered" | "unanswered";

/** Filter of the star rating. `all` sends no `rating` parameter at all. */
export type OwnerRatingFilter = "all" | 1 | 2 | 3 | 4 | 5;

/**
 * Builds the OWN-19 query.
 *
 * Only the filters that differ from "all" are sent: the backend treats a
 * missing `replied` as "both" and a missing `rating` as "any star".
 */
export function ownerReviewsQuery(
  reply: OwnerReplyFilter,
  rating: OwnerRatingFilter,
  page: number,
  pageSize: number,
): OwnerReviewsQuery {
  const query: OwnerReviewsQuery = { page, pageSize };
  if (reply === "answered") query.replied = true;
  if (reply === "unanswered") query.replied = false;
  if (rating !== "all") query.rating = rating;
  return query;
}

/** Query string of OWN-19; `page` and `pageSize` always travel with it. */
export function ownerReviewsQueryString(query: OwnerReviewsQuery) {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 10));
  if (query.replied !== undefined)
    params.set("replied", String(query.replied));
  if (query.rating !== undefined) params.set("rating", String(query.rating));
  return params.toString();
}

/** Validation of the OWN-20 body before it leaves the browser. */
export function validateReplyContent(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return "Phản hồi không được để trống.";
  if (trimmed.length > REPLY_MAX_LENGTH)
    return `Phản hồi không vượt quá ${REPLY_MAX_LENGTH} ký tự.`;
  return null;
}

/** The trimmed body sent to OWN-20. */
export function replyRequest(content: string): ReplyReviewRequestDto {
  return { content: content.trim() };
}

/** Reply visibility shown next to the owner's answer. */
export const replyStatusLabels: Record<ReviewReplyDto["status"], string> = {
  visible: "Đang hiển thị",
  hidden: "Đang bị ẩn",
  removed: "Đã bị gỡ",
};

/** A review can only be answered while it is visible to the public. */
export function canReply(status: string) {
  return status === "visible";
}

/**
 * Sums the answered/unanswered counters of the restaurant.
 *
 * OWN-19 does not return aggregates, so the two counters come from the
 * `totalItems` of the `replied=true` and `replied=false` queries.
 */
export function ownerReviewCounts(counts: OwnerReviewCounts): OwnerReviewCounts {
  return {
    answered: Math.max(0, counts.answered),
    unanswered: Math.max(0, counts.unanswered),
  };
}

/** Message shown when OWN-19 or OWN-20 fails. */
export function ownerReviewsErrorMessage(error: unknown) {
  const messages: Record<string, string> = {
    REVIEW_NOT_FOUND:
      "Không tìm thấy đánh giá này. Tải lại danh sách để xem trạng thái mới nhất.",
    REVIEW_NOT_VISIBLE:
      "Đánh giá đang bị ẩn hoặc đã bị gỡ nên không thể phản hồi.",
    RESTAURANT_NOT_FOUND: "Bạn chưa đăng ký nhà hàng.",
    VALIDATION_FAILED: "Vui lòng kiểm tra nội dung phản hồi.",
    FORBIDDEN: "Bạn không có quyền phản hồi đánh giá của nhà hàng khác.",
  };
  if (error instanceof ApiError)
    return messages[error.errorCode] ?? getErrorMessage(error);
  return getErrorMessage(error);
}

/** Field errors of a 400 response, keyed by the lower-cased field name. */
export function ownerReviewFieldErrors(error: unknown) {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(
    Object.entries(error.errors ?? {}).map(([key, messages]) => [
      key.charAt(0).toLowerCase() + key.slice(1),
      messages.join(" "),
    ]),
  );
}
