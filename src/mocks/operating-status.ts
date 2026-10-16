import { ApiError } from "@/shared/api/error";
import type { OperatingStatusService } from "@/features/owner/operating-status-service";
import { validateOperatingStatus } from "@/features/owner/operating-status-rules";
import type { OwnerRestaurantDto } from "@/features/owner/restaurant-types";

export function createMockOperatingStatusService(
  seed: OwnerRestaurantDto | null,
): OperatingStatusService {
  let current = seed ? structuredClone(seed) : null;
  const missing = () =>
    new ApiError(404, "RESTAURANT_NOT_FOUND", "Bạn chưa đăng ký nhà hàng.");
  return {
    async getOwnerRestaurant() {
      if (!current) throw missing();
      return structuredClone(current);
    },
    async updateStatus(request) {
      const errors = validateOperatingStatus(
        request.operatingStatus,
        request.note ?? "",
      );
      if (Object.keys(errors).length)
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          "Vui lòng kiểm tra thông tin.",
          Object.fromEntries(
            Object.entries(errors).map(([key, value]) => [key, [value]]),
          ),
        );
      if (!current) throw missing();
      if (
        request.operatingStatus === "open" &&
        current.operatingStatus !== "open" &&
        current.moderationStatus === "suspended"
      )
        throw new ApiError(
          409,
          "RESTAURANT_SUSPENDED",
          "Nhà hàng đang bị đình chỉ nên chưa thể mở lại.",
        );
      current = { ...current, operatingStatus: request.operatingStatus };
      return { operatingStatus: current.operatingStatus };
    },
  };
}
