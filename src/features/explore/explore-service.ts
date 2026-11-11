import { api } from "@/shared/api/client";
import { cachedRead } from "@/shared/api/read-cache";
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

/** How long a list page (DISH-01, REST-01) is reused for the same URL: a refresh or Back. */
export const listCacheMs = 30_000;
/** Tags (CAT-02) change rarely. */
export const tagCacheMs = 10 * 60_000;

/**
 * Reads are public: a guest is not sent to the login page when they fail. Writes (REV-01, REP-01,
 * MEDIA-01) need a Traveler session and use the redirecting client calls. List pages and tags are
 * reused for a short while (`cachedRead`) and can be cancelled by a newer search (`signal`).
 */
export interface ExploreService {
  browseDishes(
    query: BrowseDishesQuery,
    signal?: AbortSignal,
  ): Promise<BrowseDishesResponseDto>;
  dish(dishId: number): Promise<DishDetailDto>;
  browseRestaurants(
    query: BrowseRestaurantsQuery,
    signal?: AbortSignal,
  ): Promise<PagedDto<RestaurantCardDto>>;
  restaurant(restaurantId: number): Promise<RestaurantDetailDto>;
  menu(restaurantId: number): Promise<RestaurantMenuDto>;
  reviews(
    restaurantId: number,
    query: ReviewsQuery,
  ): Promise<RestaurantReviewsDto>;
  tags(signal?: AbortSignal): Promise<TagDto[]>;
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
  browseDishes: (query, signal) => {
    const path = `dishes${queryString(query)}`;
    return cachedRead(path, listCacheMs, () => api.getOptional(path, signal));
  },
  dish: (dishId) => api.getOptional(`dishes/${dishId}`),
  browseRestaurants: (query, signal) => {
    const path = `restaurants${queryString(query)}`;
    return cachedRead(path, listCacheMs, () => api.getOptional(path, signal));
  },
  restaurant: (restaurantId) => api.getOptional(`restaurants/${restaurantId}`),
  menu: (restaurantId) => api.getOptional(`restaurants/${restaurantId}/menu`),
  reviews: (restaurantId, query) =>
    api.getOptional(`restaurants/${restaurantId}/reviews${queryString(query)}`),
  tags: (signal) =>
    cachedRead("tags", tagCacheMs, () => api.getOptional("tags", signal)),
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
