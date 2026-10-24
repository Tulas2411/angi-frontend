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

/** Items are rendered by the roadmap detail screens (F-21+); this form only counts days. */
export interface RoadmapDayDto {
  dayId: number;
  dayNumber: number;
  date: string | null;
  note: string | null;
  dayCost: number;
  items: unknown[];
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
