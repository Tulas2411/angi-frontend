import { api } from "@/shared/api/client";
import type {
  MediaFileDto,
  OwnerRestaurantDto,
  RegisterRestaurantRequestDto,
} from "./restaurant-types";

export interface RestaurantRegistrationService {
  register: (
    request: RegisterRestaurantRequestDto,
  ) => Promise<OwnerRestaurantDto>;
  upload: (file: File) => Promise<MediaFileDto>;
}

export const restaurantService: RestaurantRegistrationService & {
  getOwnerRestaurant: () => Promise<OwnerRestaurantDto>;
} = {
  getOwnerRestaurant: () => api.get<OwnerRestaurantDto>("owner/restaurant"),
  register: (request) =>
    api.post<OwnerRestaurantDto>("owner/restaurant", request),
  upload: (file) => {
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", "restaurant");
    return api.upload<MediaFileDto>("media", body);
  },
};
