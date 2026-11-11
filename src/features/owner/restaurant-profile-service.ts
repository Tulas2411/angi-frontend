import { api } from "@/shared/api/client";
import { restaurantService } from "./restaurant-service";
import type {
  OwnerRestaurantDto,
  UpdateRestaurantRequestDto,
  MediaFileDto,
} from "./restaurant-types";

export interface RestaurantProfileService {
  getOwnerRestaurant: () => Promise<OwnerRestaurantDto>;
  updateProfile: (
    request: UpdateRestaurantRequestDto,
  ) => Promise<OwnerRestaurantDto>;
  upload: (file: File) => Promise<MediaFileDto>;
}

export const restaurantProfileService: RestaurantProfileService = {
  getOwnerRestaurant: restaurantService.getOwnerRestaurant,
  updateProfile: (request) =>
    api.patch<OwnerRestaurantDto>("owner/restaurant", request),
  upload: restaurantService.upload,
};
