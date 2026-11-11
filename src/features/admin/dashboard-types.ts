/**
 * Wire DTOs of F-63 View Dashboard (API Design v1.8: ADM-D1..ADM-D3, OPS-01; BE branch
 * feat/ANGI-189-admin-dashboard `DashboardSummaryDtos`, `DashboardTimeSeriesDtos`,
 * `DashboardTopDtos`, `OutboxMessageDtos`).
 */

/** ADM-D1: counts in the range `from`..`to` (dates, default the last 30 days). */
export interface DashboardSummaryDto {
  from: string;
  to: string;
  users: {
    total: number;
    new: number;
    /** By role code (TRAVELER, RESTAURANT_OWNER, MOD, ADMIN). */
    byRole: Record<string, number>;
    /** By `users.status`. */
    byStatus: Record<string, number>;
  };
  restaurants: {
    total: number;
    new: number;
    /** unverified | pending | verified | rejected. */
    byVerificationStatus: Record<string, number>;
    /** visible | hidden | suspended. */
    byModerationStatus: Record<string, number>;
  };
  queues: {
    pendingVerifications: number;
    pendingMenus: number;
    pendingRestaurantReports: number;
    pendingSocialReports: number;
  };
  content: { blogs: number; comments: number; reviews: number };
  roadmaps: { created: number; aiGenerationJobs: number };
  feedback: { likes: number; dislikes: number };
  outbox: { pending: number; dead: number };
}

export type DashboardMetric =
  | "new_users"
  | "new_restaurants"
  | "roadmaps"
  | "blogs"
  | "reports"
  | "feedbacks"
  | "dish_rolls";
export type DashboardInterval = "day" | "week" | "month";

/** ADM-D2: one value per bucket (the first day of the day, week or month). */
export interface DashboardTimeSeriesDto {
  metric: DashboardMetric;
  interval: DashboardInterval;
  points: { bucket: string; value: number }[];
}

export type DashboardTopType = "dishes" | "restaurants" | "blogs";

/** ADM-D3: `score` is the likes (dishes, blogs) or the average rating (restaurants). */
export interface DashboardTopDto {
  type: DashboardTopType;
  items: {
    id: number;
    name: string;
    score: number;
    subtitle: string | null;
  }[];
}

/** DTO "OutboxMessage" (OPS-01): an event to the recommendation service, pending or failed. */
export interface OutboxMessageDto {
  id: number;
  eventUuid: string;
  eventType: string;
  aggregateKey: string;
  payload: unknown;
  status: "pending" | "processing" | "dead" | string;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
  nextAttemptAt: string | null;
}

export interface OutboxPageDto {
  items: OutboxMessageDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** OPS-01 query: `status` pending | processing | dead (default dead), `pageSize` 1..100. */
export interface OutboxQuery {
  status?: "pending" | "processing" | "dead";
  eventType?: "DISH_UPSERTED" | "DISH_DEACTIVATED" | "FEEDBACK_CREATED";
  page?: number;
  pageSize?: number;
}
