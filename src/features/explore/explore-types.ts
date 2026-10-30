/** Wire DTOs of the public discovery operations (API Design v1.8: DISH-01/02, REST-01..04, REV-01, REP-01, CAT-02). */

export type DishForm = "soup" | "dry" | "other";
export type OperatingStatus =
  "open" | "temporarily_closed" | "permanently_closed";

export interface TagDto {
  id: number;
  tagType: "meal_time" | "dietary" | "category";
  code: string;
  name: string;
}

/** Restaurant as nested in a dish card. */
export interface RestaurantMiniDto {
  id: number;
  name: string;
  district: string | null;
  provinceName: string | null;
  latitude: number | null;
  longitude: number | null;
  ratingAvg: number;
}

export interface DishCardDto {
  id: number;
  name: string;
  price: number;
  coverUrl: string | null;
  dishForm: DishForm;
  isAvailable: boolean;
  likeCount: number;
  dislikeCount: number;
  tags: TagDto[];
  restaurant: RestaurantMiniDto;
  rank: number | null;
}

/** A dish listed inside a restaurant (REST-02 `menu`, REST-03): the restaurant is the page itself. */
export type MenuDishDto = Omit<DishCardDto, "restaurant"> & {
  restaurant?: RestaurantMiniDto;
};

export interface BrowseDishesResponseDto {
  requestId: string | null;
  items: DishCardDto[];
  nextCursor: string | null;
}

export interface RestaurantCardDto {
  id: number;
  name: string;
  slug: string;
  coverUrl: string | null;
  addressLine: string;
  district: string | null;
  provinceName: string | null;
  latitude: number | null;
  longitude: number | null;
  priceLevel: number | null;
  ratingAvg: number;
  ratingCount: number;
  operatingStatus: OperatingStatus;
  isOpenNow: boolean;
  distanceKm: number | null;
}

export interface DishDetailDto extends Omit<DishCardDto, "restaurant"> {
  description: string | null;
  images: string[];
  status: "active" | "hidden" | "removed";
  restaurant: RestaurantCardDto;
}

export interface BusinessHourDto {
  /** 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number;
  /** "HH:mm", Vietnam time. */
  openTime: string;
  /** "HH:mm"; earlier than `openTime` means it closes after midnight. */
  closeTime: string;
}

export interface UserSummaryDto {
  id: number;
  displayName: string;
  avatarUrl: string | null;
}

export interface ReviewReplyDto {
  content: string;
  status: "visible" | "hidden" | "removed";
  createdAt: string;
  updatedAt: string;
}

export interface ReviewDto {
  id: number;
  restaurantId: number;
  user: UserSummaryDto;
  rating: number;
  content: string | null;
  images: string[];
  roadmapItemId: number | null;
  status: "visible" | "hidden" | "removed";
  createdAt: string;
  reply: ReviewReplyDto | null;
}

export interface RestaurantDetailDto extends RestaurantCardDto {
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  ward: string | null;
  images: string[];
  businessHours: BusinessHourDto[];
  menu?: MenuDishDto[] | null;
  myReview?: ReviewDto | null;
}

export interface RestaurantMenuDto {
  restaurantId: number;
  dishes: MenuDishDto[];
}

export interface PagedDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface RestaurantReviewsDto extends PagedDto<ReviewDto> {
  ratingAvg: number;
  ratingCount: number;
  /** Count per star, keyed "1".."5". */
  ratingBreakdown: Record<string, number>;
}

export type RestaurantSort = "rating" | "distance" | "newest";
export type ReviewSort = "newest" | "rating_desc" | "rating_asc";

export interface BrowseDishesQuery {
  q?: string;
  province?: string;
  tagIds?: number[];
  excludeTagIds?: number[];
  dishForm?: DishForm;
  minPrice?: number;
  maxPrice?: number;
  cursor?: string;
  limit?: number;
}

export interface BrowseRestaurantsQuery {
  q?: string;
  province?: string;
  priceLevel?: number;
  minRating?: number;
  openNow?: boolean;
  sort?: RestaurantSort;
  page?: number;
  pageSize?: number;
}

export interface ReviewsQuery {
  rating?: number;
  hasImage?: boolean;
  sort?: ReviewSort;
  page?: number;
  pageSize?: number;
}

/** REV-01 request. `imageMediaIds` come from MEDIA-01 uploads with purpose `review`. */
export interface CreateReviewRequestDto {
  rating: number;
  content?: string;
  imageMediaIds?: number[];
}

export type ReportReasonCode =
  "wrong_info" | "closed" | "spam" | "offensive" | "hygiene" | "scam" | "other";

/** REP-01 request. `evidenceMediaIds` come from MEDIA-01 uploads with purpose `report_evidence`. */
export interface ReportRestaurantRequestDto {
  reasonCode: ReportReasonCode;
  description?: string;
  evidenceMediaIds?: number[];
}

export interface ReportRestaurantResponseDto {
  reportId: number;
  status: "pending";
}

export interface UploadedMediaDto {
  id: number;
  url: string;
  mimeType: string;
  sizeBytes: number;
  purpose: string;
  createdAt: string;
}
