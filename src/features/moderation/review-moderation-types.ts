import type { ReviewDto } from "@/features/explore/explore-types";
import type { ModRestaurantMiniDto } from "./menu-review-types";

/** Moderate User Feedback: MOD-F1..MOD-F3 wire contracts, API Design v1.8. */
export type ContentStatus = "visible" | "hidden" | "removed";

/** DTO "ModReview": every field of Review plus the reviewed restaurant. */
export interface ModReviewDto extends ReviewDto {
  restaurant: ModRestaurantMiniDto;
}

export interface ModReviewsPageDto {
  items: ModReviewDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** MOD-F1 query; `q` searches the review content and the restaurant name. */
export interface ListModReviewsQuery {
  q?: string;
  restaurantId?: number;
  userId?: number;
  rating?: number;
  status?: ContentStatus;
  page?: number;
  pageSize?: number;
}

/** MOD-F2 / MOD-F3 body; `reason` is 1..1000 characters. */
export interface UpdateContentStatusRequestDto {
  status: ContentStatus;
  reason: string;
}

export interface UpdateReviewStatusResponseDto {
  reviewId: number;
  status: ContentStatus;
}

export interface UpdateReplyStatusResponseDto {
  reviewId: number;
  replyStatus: ContentStatus;
}
