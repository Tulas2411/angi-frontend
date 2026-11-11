/**
 * F-16 View Restaurant Detail · REST-PUB-02/03/04.
 * - GET   /restaurants/{id}                            (REST-02)
 * - GET   /restaurants/{id}/menu                       (REST-03)
 * - GET   /restaurants/{id}/reviews?rating=&hasImage=&sort=&page=&pageSize= (REST-04)
 */

import { api } from "@/shared/api/client";
import { fireAndCollect } from "@/shared/api/fire-and-forget";

export interface BusinessHourDto {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

export interface DishCardForRestaurantDto {
  id: number;
  name: string;
  price: number;
  coverUrl: string | null;
  dishForm: string;
  isAvailable: boolean;
  likeCount: number;
  dislikeCount: number;
  tags: { id: number; name: string; tagType?: string }[];
  rank: number | null;
}

export interface ReviewUserDto {
  id: number;
  displayName: string;
  avatarUrl: string | null;
}

export interface ReviewReplyDto {
  content: string;
  repliedAt: string;
}

export interface ReviewDto {
  id: number;
  restaurantId: number;
  user: ReviewUserDto;
  rating: number;
  content: string | null;
  images: string[];
  roadmapItemId: number | null;
  status: string;
  createdAt: string;
  reply: ReviewReplyDto | null;
}

export interface RestaurantDetailDto {
  id: number;
  name: string;
  slug: string;
  coverUrl: string | null;
  addressLine: string;
  district: string | null;
  provinceName: string | null;
  latitude: number;
  longitude: number;
  priceLevel: number | null;
  ratingAvg: number;
  ratingCount: number;
  operatingStatus: string;
  isOpenNow: boolean;
  distanceKm: number | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  ward: string | null;
  images: string[];
  businessHours: BusinessHourDto[];
  menu: DishCardForRestaurantDto[] | null;
  myReview: ReviewDto | null;
}

export interface RestaurantMenuDto {
  restaurantId: number;
  dishes: DishCardForRestaurantDto[];
}

export interface RestaurantReviewsDto {
  items: ReviewDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  ratingAvg: number;
  ratingCount: number;
  ratingBreakdown: Record<string, number>;
}

export const restaurantDetailService = {
  async getDetail(
    restaurantId: number,
    options: { lat?: number; lng?: number; include?: string } = {},
  ): Promise<RestaurantDetailDto | undefined> {
    const params = new URLSearchParams();
    if (options.lat !== undefined) params.set("lat", String(options.lat));
    if (options.lng !== undefined) params.set("lng", String(options.lng));
    if (options.include) params.set("include", options.include);
    const qs = params.toString();
    return fireAndCollect("restaurants.detail", () =>
      api.get<RestaurantDetailDto>(`restaurants/${restaurantId}${qs ? `?${qs}` : ""}`),
    );
  },

  async getMenu(
    restaurantId: number,
    options: { tagIds?: number[]; includeUnavailable?: boolean } = {},
  ): Promise<RestaurantMenuDto | undefined> {
    const params = new URLSearchParams();
    if (options.tagIds?.length)
      for (const id of options.tagIds) params.append("tagIds", String(id));
    if (options.includeUnavailable !== undefined)
      params.set("includeUnavailable", String(options.includeUnavailable));
    const qs = params.toString();
    return fireAndCollect("restaurants.menu", () =>
      api.get<RestaurantMenuDto>(`restaurants/${restaurantId}/menu${qs ? `?${qs}` : ""}`),
    );
  },

  async getReviews(
    restaurantId: number,
    options: {
      rating?: number;
      hasImage?: boolean;
      sort?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<RestaurantReviewsDto | undefined> {
    const params = new URLSearchParams();
    if (options.rating !== undefined)
      params.set("rating", String(options.rating));
    if (options.hasImage !== undefined)
      params.set("hasImage", String(options.hasImage));
    if (options.sort) params.set("sort", options.sort);
    if (options.page) params.set("page", String(options.page));
    if (options.pageSize) params.set("pageSize", String(options.pageSize));
    const qs = params.toString();
    return fireAndCollect("restaurants.reviews", () =>
      api.get<RestaurantReviewsDto>(`restaurants/${restaurantId}/reviews${qs ? `?${qs}` : ""}`),
    );
  },
};
