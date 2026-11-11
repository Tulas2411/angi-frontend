import { ApiError } from "@/shared/api/error";
import type { BusinessHoursService } from "@/features/owner/business-hours-service";
import {
  isOpenAt,
  sortBusinessHours,
  validateBusinessHours,
} from "@/features/owner/business-hours-rules";
import type { OwnerRestaurantDto } from "@/features/owner/restaurant-types";

export function createMockBusinessHoursService(
  seed: OwnerRestaurantDto | null,
  now: () => Date = () => new Date(),
): BusinessHoursService {
  let current = seed ? structuredClone(seed) : null;
  const missing = () =>
    new ApiError(404, "RESTAURANT_NOT_FOUND", "Bạn chưa đăng ký nhà hàng.");
  return {
    async getOwnerRestaurant() {
      if (!current) throw missing();
      return structuredClone({
        ...current,
        isOpenNow: isOpenAt(current.businessHours, now()),
      });
    },
    async updateHours(request) {
      const { errors, errorCode } = validateBusinessHours(request.hours);
      if (errorCode)
        throw new ApiError(
          400,
          errorCode,
          "Vui lòng kiểm tra giờ mở cửa.",
          errorCode === "VALIDATION_FAILED"
            ? Object.fromEntries(
                Object.entries(errors).map(([key, value]) => [key, [value]]),
              )
            : undefined,
        );
      if (!current) throw missing();
      const hours = sortBusinessHours(request.hours);
      const isOpenNow = isOpenAt(hours, now());
      current = { ...current, businessHours: hours, isOpenNow };
      return structuredClone({ hours, isOpenNow });
    },
  };
}
