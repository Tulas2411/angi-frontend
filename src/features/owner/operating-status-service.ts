import { api } from "@/shared/api/client";
import { restaurantService } from "./restaurant-service";
import type {
  OwnerRestaurantDto,
  UpdateOperatingStatusRequestDto,
  UpdateOperatingStatusResponseDto,
} from "./restaurant-types";

export interface OperatingStatusService {
  getOwnerRestaurant: () => Promise<OwnerRestaurantDto>;
  updateStatus: (
    request: UpdateOperatingStatusRequestDto,
  ) => Promise<UpdateOperatingStatusResponseDto>;
}

export const operatingStatusService: OperatingStatusService = {
  getOwnerRestaurant: restaurantService.getOwnerRestaurant,
  updateStatus: (request) =>
    api.put<UpdateOperatingStatusResponseDto>(
      "owner/restaurant/operating-status",
      request,
    ),
};
