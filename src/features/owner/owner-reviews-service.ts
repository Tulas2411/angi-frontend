import { api } from "@/shared/api/client";
import { ownerReviewsQueryString } from "./owner-reviews-rules";
import type {
  OwnerReviewsQuery,
  PagedDto,
  ReplyReviewRequestDto,
  ReviewDto,
  ReviewReplyDto,
} from "./owner-reviews-types";

/**
 * OWN-19 and OWN-20 of the Restaurant Owner workspace.
 *
 * - OWN-19 `GET owner/restaurant/reviews` — the reviews of the caller's own
 *   restaurant, newest first, filtered by `replied` and `rating`.
 * - OWN-20 `PUT owner/restaurant/reviews/{reviewId}/reply` — creates or
 *   replaces the owner's answer to one review.
 */
export interface OwnerReviewsService {
  list(query: OwnerReviewsQuery): Promise<PagedDto<ReviewDto>>;
  reply(reviewId: number, request: ReplyReviewRequestDto): Promise<ReviewReplyDto>;
}

export const ownerReviewsService: OwnerReviewsService = {
  list: (query) =>
    api.get<PagedDto<ReviewDto>>(
      `owner/restaurant/reviews?${ownerReviewsQueryString(query)}`,
    ),
  reply: (reviewId, request) =>
    api.put<ReviewReplyDto>(
      `owner/restaurant/reviews/${reviewId}/reply`,
      request,
    ),
};
