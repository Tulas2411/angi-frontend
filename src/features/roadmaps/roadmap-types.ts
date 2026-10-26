import type { MapLocation } from "@/shared/maps/mapbox";

/** Wire DTOs of RM-01 / RM-04 (API Design v1.8, sheets "Chi tiết Request-Response" and "DTO"). */

export type RoadmapOriginMode = "none" | "pinned" | "gps";
export type MealSlot =
  "breakfast" | "lunch" | "dinner" | "snack" | "late_night";

export interface CreateRoadmapRequestDto {
  title: string;
  startDate?: string;
  numDays: number;
  budgetAmount?: number;
  originMode?: RoadmapOriginMode;
  originLatitude?: number;
  originLongitude?: number;
  originLabel?: string;
}

/** Omitted fields are left unchanged; `null` clears a nullable field. */
export interface UpdateRoadmapRequestDto {
  title?: string;
  startDate?: string | null;
  numDays?: number;
  budgetAmount?: number | null;
  originMode?: RoadmapOriginMode;
  originLatitude?: number | null;
  originLongitude?: number | null;
  originLabel?: string | null;
}

export interface RoadmapSummaryDto {
  id: number;
  title: string;
  startDate: string | null;
  endDate: string | null;
  numDays: number;
  budgetAmount: number | null;
  totalEstimatedCost: number;
  itemCount: number;
  coverUrl: string | null;
  originMode: RoadmapOriginMode;
  originLatitude: number | null;
  originLongitude: number | null;
  originLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Tag of a dish (DTO "Tag"). */
export interface RoadmapTagDto {
  id: number;
  tagType: "meal_time" | "dietary" | "category";
  code: string;
  name: string;
}

/** DTO "RestaurantMini", nested in a dish. Coordinates can be null. */
export interface RoadmapRestaurantDto {
  id: number;
  name: string;
  district: string | null;
  provinceName: string | null;
  latitude: number | null;
  longitude: number | null;
  ratingAvg: number;
}

/** DTO "DishCard": a dish with its restaurant, as listed by RM-06. `rank` is the reco rank. */
export interface DishCardDto {
  id: number;
  name: string;
  price: number;
  coverUrl: string | null;
  dishForm: "soup" | "dry" | "other";
  isAvailable: boolean;
  likeCount: number;
  dislikeCount: number;
  tags: RoadmapTagDto[];
  restaurant: RoadmapRestaurantDto;
  rank: number | null;
}

/** DTO "RoadmapDish": a DishCard plus the dish status. `active` is the only normal one. */
export interface RoadmapDishDto extends DishCardDto {
  status: "active" | "hidden" | "removed";
}

/** DTO "RoadmapItem". */
export interface RoadmapItemDto {
  id: number;
  dayId: number;
  dayNumber: number;
  mealSlot: MealSlot;
  sortOrder: number;
  source: "manual" | "ai";
  recoRequestId: string | null;
  dish: RoadmapDishDto;
  myFeedback: "like" | "dislike" | null;
  createdAt: string;
}

/** DTO "RoadmapDay"; items come sorted by meal slot and then sortOrder. */
export interface RoadmapDayDto {
  dayId: number;
  dayNumber: number;
  date: string | null;
  note: string | null;
  dayCost: number;
  items: RoadmapItemDto[];
}

export interface RoadmapBudgetDto {
  budgetAmount: number | null;
  totalEstimatedCost: number;
  remaining: number | null;
  isOverBudget: boolean;
  byDay: { dayNumber: number; cost: number }[];
  byMealSlot: { mealSlot: MealSlot; cost: number }[];
}

export interface RoadmapDetailDto {
  overview: RoadmapSummaryDto;
  itinerary: RoadmapDayDto[];
  budget: RoadmapBudgetDto;
}

export type RoadmapOrigin = MapLocation;

export interface RoadmapFormValues {
  /** Destination province: not stored by RM-01 (the roadmap keeps no destination). */
  province: string;
  title: string;
  startDate: string;
  numDays: string;
  budgetAmount: string;
  originMode: RoadmapOriginMode;
  originLabel: string;
}

/** RM-02 `Paged<RoadmapSummary>` (API Design v1.8, sheet "Chi tiết Request-Response" r120–r124). */
export interface RoadmapPageDto {
  items: RoadmapSummaryDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** RM-14 `GET roadmaps/{id}/days/{dayId}/route` (API Design v1.8, sheet "Chi tiết Request-Response" r185–r200). */
export interface RoadmapRouteLegDto {
  /** null = the leg starts at the origin. */
  fromItemId: number | null;
  toItemId: number;
  distanceMeters: number;
  durationSeconds: number;
}

export interface RoadmapRouteDto {
  dayId: number;
  profile: "driving" | "walking" | "cycling";
  origin: {
    latitude: number;
    longitude: number;
    label?: string | null;
    source: "pinned" | "gps";
  } | null;
  originSkipped: boolean;
  legs: RoadmapRouteLegDto[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  /** true = the provider failed and the backend estimated the distances. */
  isEstimated: boolean;
}

/**
 * RM-06 `GET roadmaps/{id}/suggestions` (API Design v1.8, sheet "Chi tiết Request-Response"
 * r136–r138): ranked dishes that are not in the roadmap yet.
 */
export interface RoadmapSuggestionsDto {
  /** The reco request id; sent back by RM-07 when a suggested dish is chosen. */
  requestId: string;
  items: DishCardDto[];
  nextCursor: string | null;
}

/** RM-07 body (r139–r142). Without `sortOrder` the item goes to the end of its meal. */
export interface AddRoadmapItemRequestDto {
  dishId: number;
  mealSlot: MealSlot;
  sortOrder?: number;
  recoRequestId?: string;
}

/**
 * RM-08 body (API Design v1.8, sheet "Chi tiết Request-Response" r144–r148): every field is
 * optional and only the sent ones change. `sortOrder` is the new position inside the meal; the
 * backend does not shift the neighbours. `dishId` (replace the dish) is not used by the app yet.
 */
export interface UpdateRoadmapItemRequestDto {
  dishId?: number;
  recoRequestId?: string;
  dayId?: number;
  mealSlot?: MealSlot;
  sortOrder?: number;
}

/** RM-13 body (API Design v1.8, sheet "Chi tiết Request-Response" r178). */
export interface RateRoadmapItemRequestDto {
  value: "like" | "dislike";
}

/**
 * RM-13 `201 Created` data (r179–r184). The counters are the dish's `like_count` /
 * `dislike_count` after the rating, for display only.
 */
export interface RateRoadmapItemResponseDto {
  feedbackId: number;
  value: "like" | "dislike";
  dishId: number;
  likeCount: number;
  dislikeCount: number;
  createdAt: string;
}

/** RM-06 query (Backend API row r36). `province` is required: a roadmap keeps no destination. */
export interface RoadmapSuggestionsQuery {
  province: string;
  dayId?: number;
  mealSlot?: MealSlot;
  q?: string;
  /** VND, whole number, ≥ 0. */
  maxPrice?: number;
  /** GPS position; both coordinates go together. Without them the pinned origin is used. */
  lat?: number;
  lng?: number;
  cursor?: string;
  /** 1..50, the backend default is 20. */
  limit?: number;
}

/** RM-10 `scope`: the whole roadmap, one day (needs `dayId`) or one meal of a day (needs both). */
export type GenerationScope = "full" | "day" | "slot";

/** RM-11 `status`; RM-10 always answers `queued`. */
export type GenerationStatus = "queued" | "running" | "succeeded" | "failed";

/**
 * RM-10 body (API Design v1.8, sheet "Chi tiết Request-Response" r151–r163). `province` is
 * required because a roadmap keeps no destination; everything else is optional.
 */
export interface GenerateRoadmapRequestDto {
  scope: GenerationScope;
  /** Required for `day` and `slot`. */
  dayId?: number;
  /** Required for `slot`. */
  mealSlot?: MealSlot;
  /** true = the items of the covered meals are deleted before generating; default false. */
  replaceExisting?: boolean;
  province: string;
  /** Meals to fill (default breakfast, lunch, dinner); one dish per meal. */
  mealSlots?: MealSlot[];
  /** VND, whole number, ≥ 0. */
  maxPricePerMeal?: number;
  /** Preferred tags (not a filter). */
  tagIds?: number[];
  /** Dishes with any of these tags are left out. */
  excludeTagIds?: number[];
  /** ≤ 500 characters. */
  note?: string;
  /** GPS position for a `gps` roadmap; both coordinates go together. */
  currentLatitude?: number;
  currentLongitude?: number;
  /** 1..50, the backend default is 10. */
  radiusKm?: number;
}

/** RM-10 `202 Accepted` data (r164–r165). */
export interface GenerateRoadmapResponseDto {
  jobId: number;
  status: "queued";
}

/** RM-11 `200 OK` data (r166–r172). `createdItemIds` is empty until the job has finished. */
export interface GenerationJobDto {
  jobId: number;
  scope: GenerationScope;
  status: GenerationStatus;
  errorMessage: string | null;
  createdItemIds: number[];
  createdAt: string;
  finishedAt: string | null;
}
