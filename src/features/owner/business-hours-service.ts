import { api } from "@/shared/api/client";
import { restaurantService } from "./restaurant-service";
import type {
  OwnerRestaurantDto,
  UpdateBusinessHoursRequestDto,
  UpdateBusinessHoursResponseDto,
} from "./restaurant-types";

export interface BusinessHoursService {
  getOwnerRestaurant: () => Promise<OwnerRestaurantDto>;
  updateHours: (
    request: UpdateBusinessHoursRequestDto,
  ) => Promise<UpdateBusinessHoursResponseDto>;
}

export const businessHoursService: BusinessHoursService = {
  getOwnerRestaurant: restaurantService.getOwnerRestaurant,
  updateHours: (request) =>
    api.put<UpdateBusinessHoursResponseDto>(
      "owner/restaurant/business-hours",
      request,
    ),
};
