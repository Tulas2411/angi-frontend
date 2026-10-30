/**
 * OWN-19/OWN-20 wire contracts, API Design v1.8.
 *
 * The owner reads every review of their own restaurant — including the ones a
 * moderator has hidden — but may only reply to the visible ones.
 */

/** ContentStatus of a review or of an owner reply. */
export type OwnerReviewStatus = "visible" | "hidden" | "removed";

export interface OwnerReviewUserDto {
  id: number;
  displayName: string;
  avatarUrl: string | null;
}

export interface OwnerReviewReplyDto {
  content: string;
  status: OwnerReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerReviewDto {
  id: number;
  restaurantId: number;
  user: OwnerReviewUserDto;
  rating: number;
  content: string | null;
  images: string[];
  roadmapItemId: number | null;
  status: OwnerReviewStatus;
  createdAt: string;
  /** Present when the owner has already replied, whatever the moderation state. */
  reply: OwnerReviewReplyDto | null;
}

export interface OwnerReviewsPageDto {
  items: OwnerReviewDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** OWN-19 filters; `replied` is the only boolean the backend accepts. */
export interface OwnerReviewsQuery {
  replied?: boolean;
  rating?: number;
  page?: number;
  pageSize?: number;
}

/** OWN-20 body. The backend also accepts `replyContent`; `content` is canonical. */
export interface ReplyOwnerReviewRequestDto {
  content: string;
}
