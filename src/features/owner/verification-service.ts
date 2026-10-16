import { api } from "@/shared/api/client";
import type { MediaFileDto, OwnerRestaurantDto } from "./restaurant-types";
import type {
  SubmitVerificationRequestDto,
  VerificationDto,
} from "./verification-types";

export interface VerificationService {
  getOwnerRestaurant: () => Promise<OwnerRestaurantDto>;
  upload: (file: File) => Promise<MediaFileDto>;
  submit: (request: SubmitVerificationRequestDto) => Promise<VerificationDto>;
}

export const verificationService: VerificationService = {
  getOwnerRestaurant: () => api.get<OwnerRestaurantDto>("owner/restaurant"),
  upload: (file) => {
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", "verification_doc");
    return api.upload<MediaFileDto>("media", body);
  },
  submit: (request) =>
    api.post<VerificationDto>("owner/restaurant/verifications", request),
};
