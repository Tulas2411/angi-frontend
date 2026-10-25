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
