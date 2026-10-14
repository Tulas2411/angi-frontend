import { ApiError } from "@/shared/api/error";
import type { RestaurantRegistrationService } from "@/features/owner/restaurant-service";
import type { MediaFileDto } from "@/features/owner/restaurant-types";
import { validateRestaurantImage } from "@/features/owner/registration-rules";

/** Same wire shape as JSON samples; state and media stay in this demo instance. */
export function createMockRestaurantRegistrationService(): RestaurantRegistrationService {
  let registered = false;
  let nextMediaId = 9000;
  const media = new Map<number, MediaFileDto>();
  return {
    async upload(file) {
      const problem = validateRestaurantImage(file);
      if (problem)
        throw new ApiError(
          400,
          file.size > 5 * 1024 * 1024
            ? "FILE_TOO_LARGE"
            : "UNSUPPORTED_MEDIA_TYPE",
          problem,
        );
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Không đọc được ảnh."));
        reader.readAsDataURL(file);
      });
      const result = {
        id: ++nextMediaId,
        url,
        mimeType: file.type,
        sizeBytes: file.size,
        purpose: "restaurant",
        createdAt: new Date().toISOString(),
      };
      media.set(result.id, result);
      return result;
    },
    async register(request) {
      if (registered)
        throw new ApiError(
          409,
          "OWNER_ALREADY_HAS_RESTAURANT",
          "Bạn đã đăng ký một nhà hàng.",
        );
      registered = true;
      const now = new Date().toISOString();
      return {
        id: 7,
        name: request.name,
        slug: "demo-restaurant",
        coverUrl: request.coverMediaId
          ? (media.get(request.coverMediaId)?.url ?? null)
          : null,
        addressLine: request.addressLine,
        district: request.district,
        provinceName: request.provinceName,
        latitude: request.latitude,
        longitude: request.longitude,
        priceLevel: request.priceLevel ?? null,
        ratingAvg: 0,
        ratingCount: 0,
        operatingStatus: "open",
        isOpenNow: false,
        distanceKm: null,
        description: request.description ?? null,
        phone: request.phone,
        email: request.email ?? null,
        website: request.website ?? null,
        ward: request.ward ?? null,
        images: (request.imageMediaIds ?? []).map(
          (id) => media.get(id)?.url ?? "",
        ),
        businessHours: request.businessHours ?? [],
        menu: null,
        myReview: null,
        verificationStatus: "unverified",
        moderationStatus: "visible",
        latestVerification: null,
        openMenuSubmission: null,
        createdAt: now,
        updatedAt: now,
      };
    },
  };
}
