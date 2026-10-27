import { api } from "@/shared/api/client";
import type {
  BrowseDishesQuery,
  BrowseDishesResponseDto,
  BrowseRestaurantsQuery,
  CreateReviewRequestDto,
  DishDetailDto,
  PagedDto,
  ReportRestaurantRequestDto,
  ReportRestaurantResponseDto,
  RestaurantCardDto,
  RestaurantDetailDto,
  RestaurantMenuDto,
  RestaurantReviewsDto,
  ReviewDto,
  ReviewsQuery,
  TagDto,
  UploadedMediaDto,
} from "./explore-types";

/** `?a=1&b=2` from the defined values; arrays repeat the key (`tagIds=1&tagIds=2`). */
export function queryString(query: object) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value))
      for (const item of value) params.append(key, String(item));
    else params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

/**
 * Reads are public: a guest is not sent to the login page when they fail. Writes (REV-01, REP-01,
 * MEDIA-01) need a Traveler session and use the redirecting client calls.
 */
export interface ExploreService {
  browseDishes(query: BrowseDishesQuery): Promise<BrowseDishesResponseDto>;
  dish(dishId: number): Promise<DishDetailDto>;
  browseRestaurants(
    query: BrowseRestaurantsQuery,
  ): Promise<PagedDto<RestaurantCardDto>>;
  restaurant(restaurantId: number): Promise<RestaurantDetailDto>;
  menu(restaurantId: number): Promise<RestaurantMenuDto>;
  reviews(
    restaurantId: number,
    query: ReviewsQuery,
  ): Promise<RestaurantReviewsDto>;
  tags(): Promise<TagDto[]>;
  createReview(
    restaurantId: number,
    request: CreateReviewRequestDto,
  ): Promise<ReviewDto>;
  reportRestaurant(
    restaurantId: number,
    request: ReportRestaurantRequestDto,
  ): Promise<ReportRestaurantResponseDto>;
  upload(
    file: File,
    purpose: "review" | "report_evidence",
  ): Promise<UploadedMediaDto>;
}

export const exploreService: ExploreService = {
  browseDishes: (query) => api.getOptional(`dishes${queryString(query)}`),
  dish: (dishId) => api.getOptional(`dishes/${dishId}`),
  browseRestaurants: (query) =>
    api.getOptional(`restaurants${queryString(query)}`),
  restaurant: (restaurantId) => api.getOptional(`restaurants/${restaurantId}`),
  menu: (restaurantId) => api.getOptional(`restaurants/${restaurantId}/menu`),
  reviews: (restaurantId, query) =>
    api.getOptional(`restaurants/${restaurantId}/reviews${queryString(query)}`),
  tags: () => api.getOptional("tags"),
  createReview: (restaurantId, request) =>
    api.post(`restaurants/${restaurantId}/reviews`, request),
  reportRestaurant: (restaurantId, request) =>
    api.post(`restaurants/${restaurantId}/reports`, request),
  upload: (file, purpose) => {
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", purpose);
    return api.upload("media", body);
  },
};
