import type { RestaurantCardDto } from "@/features/explore/explore-types";
import type { AdminUserCardDto } from "@/features/admin/permission-types";
import type { OwnerMenuDishDto } from "@/features/owner/menu-types";
import type {
  OperatingStatus,
  OwnerRestaurantDto,
} from "@/features/owner/restaurant-types";
import type { ReportDto } from "./moderation-types";

/** F-56 Moderate Restaurant: MOD-R1..MOD-R4 wire contracts, API Design v1.8. */
export type RestaurantModerationStatus = OwnerRestaurantDto["moderationStatus"];
export type RestaurantVerificationStatus =
  OwnerRestaurantDto["verificationStatus"];

/** DTO "ModRestaurantCard": every field of RestaurantCard plus the three moderation fields. */
export interface ModRestaurantCardDto extends RestaurantCardDto {
  verificationStatus: RestaurantVerificationStatus;
  moderationStatus: RestaurantModerationStatus;
  pendingReportCount: number;
}

export interface ModRestaurantsPageDto {
  items: ModRestaurantCardDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** MOD-R1 query; `pageSize` is 1..100. */
export interface ListModRestaurantsQuery {
  q?: string;
  province?: string;
  verificationStatus?: RestaurantVerificationStatus;
  operatingStatus?: OperatingStatus;
  moderationStatus?: RestaurantModerationStatus;
  hasPendingReports?: boolean;
  page?: number;
  pageSize?: number;
}

/** DTO "AuditLog". */
export interface AuditLogDto {
  id: number;
  actor: { id: number; displayName: string; role: string | null } | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  subjectUser: {
    id: number;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  createdAt: string;
}

/** MOD-R2: every field of OwnerRestaurant plus owner, running menu (hidden dishes too), reports, audit. */
export interface ModRestaurantDetailDto extends OwnerRestaurantDto {
  owner: AdminUserCardDto;
  dishes: OwnerMenuDishDto[];
  reports: ReportDto[];
  recentAudit: AuditLogDto[];
}

/** MOD-R3 body. */
export interface UpdateRestaurantModerationStatusRequestDto {
  moderationStatus: RestaurantModerationStatus;
  reason: string;
  reportId?: number;
}

export interface UpdateRestaurantModerationStatusResponseDto {
  restaurantId: number;
  moderationStatus: RestaurantModerationStatus;
}

/** MOD-R4 body. */
export interface UpdateDishModerationStatusRequestDto {
  status: "active" | "hidden";
  reason: string;
}

export interface UpdateDishModerationStatusResponseDto {
  dishId: number;
  status: "active" | "hidden";
}
