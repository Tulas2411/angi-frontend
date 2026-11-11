import { api } from "@/shared/api/client";
import type { ReportDto, ResolveReportRequestDto } from "./moderation-types";
import { moderationReportsService } from "./moderation-service";
import type {
  ListModRestaurantsQuery,
  ModRestaurantDetailDto,
  ModRestaurantsPageDto,
  UpdateDishModerationStatusRequestDto,
  UpdateDishModerationStatusResponseDto,
  UpdateRestaurantModerationStatusRequestDto,
  UpdateRestaurantModerationStatusResponseDto,
} from "./restaurant-moderation-types";

/** F-56 through the same-origin proxy (Mod and Admin sessions). */
export interface RestaurantModerationService {
  /** MOD-R1: one page of restaurants, unverified and hidden ones included. */
  list(query: ListModRestaurantsQuery): Promise<ModRestaurantsPageDto>;
  /** MOD-R2: profile, owner, running menu, reports and recent audit. */
  detail(restaurantId: number): Promise<ModRestaurantDetailDto>;
  /** MOD-R3: shows, hides or suspends the restaurant; `reason` is required. */
  updateStatus(
    restaurantId: number,
    request: UpdateRestaurantModerationStatusRequestDto,
  ): Promise<UpdateRestaurantModerationStatusResponseDto>;
  /** MOD-R4: hides or shows one dish; `reason` is required. */
  updateDish(
    dishId: number,
    request: UpdateDishModerationStatusRequestDto,
  ): Promise<UpdateDishModerationStatusResponseDto>;
  /** MOD-RP4: concludes a report on the restaurant. */
  resolveReport(
    reportId: number,
    request: ResolveReportRequestDto,
  ): Promise<ReportDto>;
}

export function modRestaurantsQueryString(query: ListModRestaurantsQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.province) params.set("province", query.province);
  if (query.verificationStatus)
    params.set("verificationStatus", query.verificationStatus);
  if (query.operatingStatus)
    params.set("operatingStatus", query.operatingStatus);
  if (query.moderationStatus)
    params.set("moderationStatus", query.moderationStatus);
  if (query.hasPendingReports) params.set("hasPendingReports", "true");
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.pageSize !== undefined)
    params.set("pageSize", String(query.pageSize));
  const text = params.toString();
  return text ? `?${text}` : "";
}

export const restaurantModerationService: RestaurantModerationService = {
  list: (query) =>
    api.get<ModRestaurantsPageDto>(
      `mod/restaurants${modRestaurantsQueryString(query)}`,
    ),
  detail: (restaurantId) =>
    api.get<ModRestaurantDetailDto>(`mod/restaurants/${restaurantId}`),
  updateStatus: (restaurantId, request) =>
    api.put<UpdateRestaurantModerationStatusResponseDto>(
      `mod/restaurants/${restaurantId}/moderation-status`,
      request,
    ),
  updateDish: (dishId, request) =>
    api.put<UpdateDishModerationStatusResponseDto>(
      `mod/dishes/${dishId}/moderation-status`,
      request,
    ),
  resolveReport: (reportId, request) =>
    moderationReportsService.resolve(reportId, request),
};
