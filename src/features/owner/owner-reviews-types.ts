import type {
  PagedDto,
  ReviewDto,
  ReviewReplyDto,
} from "@/features/explore/explore-types";

export type { PagedDto, ReviewDto, ReviewReplyDto };

/**
 * OWN-19 query.
 *
 * `replied` and `rating` are omitted when the filter is "all"; the backend
 * treats a missing `replied` as "both" and a missing `rating` as "any star".
 */
export interface OwnerReviewsQuery {
  replied?: boolean;
  rating?: number;
  page?: number;
  pageSize?: number;
}

/** OWN-20 body. The backend also accepts `replyContent` as an alias. */
export interface ReplyReviewRequestDto {
  content: string;
}

/** Reply visibility as returned by OWN-20 and nested in OWN-19. */
export type OwnerReplyStatus = ReviewReplyDto["status"];

/** Visibility of a review itself. */
export type OwnerReviewStatus = ReviewDto["status"];

/**
 * Counters of the owner's restaurant.
 *
 * OWN-19 returns a page of reviews, not aggregates, so the counters are read
 * from two cheap queries (`replied=true` and `replied=false`, `pageSize=1`)
 * whose `totalItems` carry the counts.
 */
export interface OwnerReviewCounts {
  answered: number;
  unanswered: number;
}
