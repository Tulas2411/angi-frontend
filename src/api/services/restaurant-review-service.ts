import { api } from "@/shared/api/client";
import type {
  CreateRestaurantReportRequestDto,
  CreateRestaurantReportResponseDto,
  CreateRestaurantReviewRequestDto,
  PagedDto,
  ReviewDto,
  ReviewReplyDto,
} from "@/shared/types/angi-dto";

/** Query của OWN-19. */
export interface OwnerReviewQuery {
  /** `true` = chỉ lấy đánh giá đã có phản hồi, `false` = chỉ lấy chưa phản hồi. */
  replied?: boolean;
  rating?: number;
  page?: number;
  pageSize?: number;
}

function queryString(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export interface RestaurantReviewService {
  /**
   * REV-01 — 201 Created, đánh giá vừa gửi.
   * `imageMediaIds` là id của media đã tải lên qua MEDIA-01 (purpose `review`).
   */
  create(
    restaurantId: number,
    request: CreateRestaurantReviewRequestDto,
  ): Promise<ReviewDto>;
  /** REP-01 — 201 Created, mã và trạng thái báo cáo nhà hàng. */
  report(
    restaurantId: number,
    request: CreateRestaurantReportRequestDto,
  ): Promise<CreateRestaurantReportResponseDto>;
}

export interface OwnerReviewService {
  /** OWN-19 — 200 OK, một trang đánh giá của nhà hàng đang đăng nhập. */
  list(query?: OwnerReviewQuery): Promise<PagedDto<ReviewDto>>;
  /** OWN-20 — 200 OK, phản hồi vừa tạo hoặc vừa sửa. */
  reply(reviewId: number, content: string): Promise<ReviewReplyDto>;
}

export const restaurantReviewService: RestaurantReviewService = {
  create: (restaurantId, request) =>
    api.post<ReviewDto>(`restaurants/${restaurantId}/reviews`, request),
  report: (restaurantId, request) =>
    api.post<CreateRestaurantReportResponseDto>(
      `restaurants/${restaurantId}/reports`,
      request,
    ),
};

export const ownerReviewService: OwnerReviewService = {
  list: (query) =>
    api.get<PagedDto<ReviewDto>>(
      `owner/restaurant/reviews${queryString({
        replied: query?.replied,
        rating: query?.rating,
        page: query?.page,
        pageSize: query?.pageSize,
      })}`,
    ),
  reply: (reviewId, content) =>
    api.put<ReviewReplyDto>(`owner/restaurant/reviews/${reviewId}/reply`, {
      content,
    }),
};
