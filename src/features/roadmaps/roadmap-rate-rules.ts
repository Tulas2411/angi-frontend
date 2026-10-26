import { ApiError, getErrorMessage } from "@/shared/api/error";

export type RatingValue = "like" | "dislike";

/** What a rating is called in the buttons and the notices. */
export const ratingLabels: Record<
  RatingValue,
  { action: string; done: string }
> = {
  like: { action: "Thích", done: "đã thích" },
  dislike: {
    action: "Không thích",
    done: "đã không thích",
  },
};

/** Accessible name of a rating button; the traveler only sees their own choice, never totals. */
export function ratingButtonLabel(
  value: RatingValue,
  dishName: string,
  rated: RatingValue | null,
) {
  if (rated === value) return `Bạn ${ratingLabels[value].done} ${dishName}`;
  return `${ratingLabels[value].action} ${dishName}`;
}

/** The sentence after a rating was saved. */
export function ratedNotice(value: RatingValue, dishName: string) {
  return value === "like"
    ? `Đã ghi nhận bạn thích ${dishName}.`
    : `Đã ghi nhận bạn không thích ${dishName}.`;
}

/** RM-13 results that are not a plain success but leave nothing for the traveler to retry. */
export type RateSettled = "already-rated" | "gone";

/**
 * RM-13 failures by `errorCode`: `FEEDBACK_ALREADY_EXISTS` (409, the dish was rated before, maybe
 * from another tab) and `ROADMAP_ITEM_NOT_FOUND` (404, the dish left the roadmap) are settled:
 * the screen reads the roadmap again and says so. Anything else can be tried again.
 */
export function rateItemError(
  error: unknown,
  dishName: string,
): { settled: RateSettled | null; message: string } {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "FEEDBACK_ALREADY_EXISTS")
    return {
      settled: "already-rated",
      message: `${dishName} đã được đánh giá trước đó, nên không đánh giá lại được. Danh sách đã được cập nhật.`,
    };
  if (code === "ROADMAP_ITEM_NOT_FOUND")
    return {
      settled: "gone",
      message: `${dishName} không còn trong lộ trình nên chưa đánh giá được. Danh sách đã được cập nhật.`,
    };
  if (code === "VALIDATION_FAILED")
    return {
      settled: null,
      message: "Đánh giá chưa hợp lệ. Hãy thử lại.",
    };
  return { settled: null, message: getErrorMessage(error) };
}

/** The rating itself failed (network, 5xx…): the dish is still unrated and the buttons can be pressed again. */
export function rateFailedNotice(dishName: string, message: string) {
  return `Chưa ghi nhận được đánh giá cho ${dishName}. ${message}`;
}

/** The rating was saved but RM-03 could not be read again, so the buttons may look unrated. */
export const rateReloadFailed =
  "Đã ghi nhận đánh giá nhưng chưa tải lại được lộ trình. Hãy tải lại trang để thấy trạng thái mới.";
