import type { AppData, Restaurant } from "@/features/platform/contracts";
import type {
  OwnerRestaurantDto,
  MediaFileDto,
} from "@/features/owner/restaurant-types";
import type { RestaurantProfileService } from "@/features/owner/restaurant-profile-service";
import { validateProfilePatch } from "@/features/owner/profile-rules";
import { ApiError } from "@/shared/api/error";
import { createMockRestaurantRegistrationService } from "./restaurant-registration";

/** Explicit fixture-to-wire mapping; arrays/nulls follow OWN-02, not FE string IDs. */
export function ownerProfileFromDemo(
  restaurant: Restaurant,
  hours: AppData["hours"],
): OwnerRestaurantDto {
  return {
    id: 7,
    name: restaurant.name,
    slug: "demo-restaurant",
    coverUrl: restaurant.image || null,
    addressLine: restaurant.address,
    district: restaurant.district || null,
    provinceName: restaurant.province || null,
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
    priceLevel: restaurant.priceLevel ?? null,
    ratingAvg: restaurant.rating,
    ratingCount: 0,
    operatingStatus:
      restaurant.operating === "closed"
        ? "temporarily_closed"
        : restaurant.operating,
    isOpenNow: false,
    distanceKm: null,
    description: restaurant.description || null,
    phone: restaurant.phone || null,
    email: restaurant.email || null,
    website: restaurant.website || null,
    ward: restaurant.ward || null,
    images: [...(restaurant.photos ?? [])],
    businessHours:
      restaurant.businessHours?.map((hour) => ({ ...hour })) ??
      hours.flatMap((hour, index) =>
        hour.closed
          ? []
          : [
              {
                dayOfWeek: (index + 1) % 7,
                openTime: hour.open,
                closeTime: hour.close,
              },
            ],
      ),
    menu: null,
    myReview: null,
    verificationStatus:
      restaurant.verification === "needs_changes"
        ? "rejected"
        : restaurant.verification,
    moderationStatus: restaurant.moderation,
    latestVerification: null,
    openMenuSubmission: null,
    createdAt: "2026-09-25T02:00:00Z",
    updatedAt: "2026-10-01T09:00:00Z",
  };
}

export function createMockRestaurantProfileService(
  seed: OwnerRestaurantDto | null,
): RestaurantProfileService {
  let current = seed ? structuredClone(seed) : null;
  const uploader = createMockRestaurantRegistrationService();
  const media = new Map<number, MediaFileDto>();
  const notFound = () =>
    new ApiError(404, "RESTAURANT_NOT_FOUND", "Bạn chưa đăng ký nhà hàng.");
  return {
    async getOwnerRestaurant() {
      if (!current) throw notFound();
      return structuredClone(current);
    },
    async upload(file) {
      const uploaded = await uploader.upload(file);
      media.set(uploaded.id, uploaded);
      return uploaded;
    },
    async updateProfile(patch) {
      if (!current) throw notFound();
      const errors = validateProfilePatch(patch);
      if (patch.coverMediaId != null && !media.has(patch.coverMediaId))
        errors.coverMediaId = "Ảnh bìa không thuộc tài khoản của bạn.";
      if (patch.imageMediaIds?.some((id) => !media.has(id)))
        errors.imageMediaIds =
          "Một hoặc nhiều ảnh không thuộc tài khoản của bạn.";
      if (Object.keys(errors).length) {
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          "Vui lòng kiểm tra thông tin đã nhập.",
          Object.fromEntries(
            Object.entries(errors).map(([key, message]) => [key, [message]]),
          ),
        );
      }
      const next: OwnerRestaurantDto = { ...current };
      for (const key of [
        "name",
        "phone",
        "addressLine",
        "provinceName",
      ] as const) {
        const value = patch[key];
        if (value !== undefined) next[key] = value.trim();
      }
      for (const key of [
        "description",
        "email",
        "website",
        "ward",
        "district",
      ] as const) {
        const value = patch[key];
        if (value !== undefined) next[key] = value?.trim() || null;
      }
      if (next.email) next.email = next.email.toLowerCase();
      if (patch.latitude !== undefined) next.latitude = patch.latitude;
      if (patch.longitude !== undefined) next.longitude = patch.longitude;
      if (patch.priceLevel !== undefined) next.priceLevel = patch.priceLevel;
      if (patch.coverMediaId !== undefined)
        next.coverUrl =
          patch.coverMediaId === null
            ? null
            : (media.get(patch.coverMediaId)?.url ?? null);
      if (patch.imageMediaIds !== undefined)
        next.images = patch.imageMediaIds.map((id) => media.get(id)?.url ?? "");
      if (JSON.stringify(next) !== JSON.stringify(current))
        next.updatedAt = new Date().toISOString();
      current = next;
      return structuredClone(next);
    },
  };
}
