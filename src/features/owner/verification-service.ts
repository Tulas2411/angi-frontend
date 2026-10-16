import { api } from "@/shared/api/client";
import type { MediaFileDto, OwnerRestaurantDto } from "./restaurant-types";
import type {
  GetVerificationStatusResponseDto,
  ResubmitVerificationRequestDto,
  SubmitVerificationRequestDto,
  VerificationDto,
} from "./verification-types";

export interface VerificationService {
  getOwnerRestaurant: () => Promise<OwnerRestaurantDto>;
  getHistory: () => Promise<GetVerificationStatusResponseDto>;
  upload: (file: File) => Promise<MediaFileDto>;
  submit: (request: SubmitVerificationRequestDto) => Promise<VerificationDto>;
  resubmit: (
    verificationId: number,
    request: ResubmitVerificationRequestDto,
  ) => Promise<VerificationDto>;
}

export const verificationService: VerificationService = {
  getOwnerRestaurant: () => api.get<OwnerRestaurantDto>("owner/restaurant"),
  getHistory: () =>
    api.get<GetVerificationStatusResponseDto>("owner/restaurant/verifications"),
  upload: (file) => {
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", "verification_doc");
    return api.upload<MediaFileDto>("media", body);
  },
  submit: (request) =>
    api.post<VerificationDto>("owner/restaurant/verifications", request),
  resubmit: (verificationId, request) =>
    api.post<VerificationDto>(
      `owner/restaurant/verifications/${verificationId}/resubmit`,
      request,
    ),
};
