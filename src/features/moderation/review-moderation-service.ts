import { api } from "@/shared/api/client";
import type {
  ListModReviewsQuery,
  ModReviewsPageDto,
  UpdateContentStatusRequestDto,
  UpdateReplyStatusResponseDto,
  UpdateReviewStatusResponseDto,
} from "./review-moderation-types";

/** Moderate User Feedback through the same-origin proxy (Mod and Admin sessions). */
export interface ReviewModerationService {
  /** MOD-F1: one page of restaurant reviews in any status. */
  list(query: ListModReviewsQuery): Promise<ModReviewsPageDto>;
  /** MOD-F2: shows, hides or removes a review; the restaurant rating is recomputed. */
  updateReview(
    reviewId: number,
    request: UpdateContentStatusRequestDto,
  ): Promise<UpdateReviewStatusResponseDto>;
  /** MOD-F3: shows, hides or removes the owner's reply to a review. */
  updateReply(
    reviewId: number,
    request: UpdateContentStatusRequestDto,
  ): Promise<UpdateReplyStatusResponseDto>;
}

export function modReviewsQueryString(query: ListModReviewsQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.restaurantId)
    params.set("restaurantId", String(query.restaurantId));
  if (query.userId) params.set("userId", String(query.userId));
  if (query.rating) params.set("rating", String(query.rating));
  if (query.status) params.set("status", query.status);
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.pageSize !== undefined)
    params.set("pageSize", String(query.pageSize));
  const text = params.toString();
  return text ? `?${text}` : "";
}

export const reviewModerationService: ReviewModerationService = {
  list: (query) =>
    api.get<ModReviewsPageDto>(`mod/reviews${modReviewsQueryString(query)}`),
  updateReview: (reviewId, request) =>
    api.put<UpdateReviewStatusResponseDto>(
      `mod/reviews/${reviewId}/status`,
      request,
    ),
  updateReply: (reviewId, request) =>
    api.put<UpdateReplyStatusResponseDto>(
      `mod/reviews/${reviewId}/reply/status`,
      request,
    ),
};
