import { api } from "@/shared/api/client";
import type {
  OwnerReviewDto,
  OwnerReviewReplyDto,
  OwnerReviewsPageDto,
  OwnerReviewsQuery,
  ReplyOwnerReviewRequestDto,
} from "./owner-reviews-types";

/**
 * OWN-19 reads the owner's own reviews and OWN-20 writes the reply.
 *
 * Both live behind the same-origin proxy (`/api/backend/owner/restaurant/reviews`)
 * so the access token never reaches the browser.
 */
export interface OwnerReviewsService {
  /** OWN-19: one page of the reviews of the restaurant the owner manages. */
  list(query: OwnerReviewsQuery): Promise<OwnerReviewsPageDto>;
  /** OWN-20: creates the reply, or replaces it when one already exists. */
  reply(
    reviewId: number,
    request: ReplyOwnerReviewRequestDto,
  ): Promise<OwnerReviewReplyDto>;
}

const base = "owner/restaurant/reviews";

export const ownerReviewsService: OwnerReviewsService = {
  list: (query) => {
    const params = new URLSearchParams();
    if (query.replied !== undefined)
      params.set("replied", String(query.replied));
    if (query.rating !== undefined)
      params.set("rating", String(query.rating));
    if (query.page !== undefined) params.set("page", String(query.page));
    if (query.pageSize !== undefined)
      params.set("pageSize", String(query.pageSize));
    const search = params.toString();
    return api.get<OwnerReviewsPageDto>(`${base}${search ? `?${search}` : ""}`);
  },
  reply: (reviewId, request) =>
    api.put<OwnerReviewReplyDto>(
      `${base}/${reviewId}/reply`,
      request,
    ),
};

/** Narrowing helper: a reply only counts as published when it is visible. */
export function hasPublishedReply(review: OwnerReviewDto): boolean {
  return !!review.reply && review.reply.status === "visible";
}
