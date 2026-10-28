import { ApiError, getErrorMessage } from "@/shared/api/error";
import type { RollDishRequestDto, RollMealTime } from "./roll-service";

/** DISH-03 accepts at most 50 dishes to leave out. */
export const maxExcludedDishes = 50;

export const rollMealOptions: { value: "" | RollMealTime; label: string }[] = [
  { value: "", label: "Bữa nào cũng được" },
  { value: "breakfast", label: "Bữa sáng" },
  { value: "lunch", label: "Bữa trưa" },
  { value: "dinner", label: "Bữa tối" },
  { value: "snack", label: "Ăn vặt" },
];

export const rollRadiusOptions: { value: string; label: string }[] = [
  { value: "1", label: "Trong 1 km" },
  { value: "3", label: "Trong 3 km" },
  { value: "5", label: "Trong 5 km" },
  { value: "10", label: "Trong 10 km" },
  { value: "20", label: "Trong 20 km" },
];

export interface RollFilters {
  mealTime: "" | RollMealTime;
  province: string;
  maxPrice: string;
  tagIds: number[];
  /** Only around the visitor: the coordinates come from the browser, never stored. */
  nearby: boolean;
  radiusKm: string;
}

export const emptyRollFilters: RollFilters = {
  mealTime: "",
  province: "",
  maxPrice: "",
  tagIds: [],
  nearby: false,
  radiusKm: "3",
};

export interface RollPosition {
  latitude: number;
  longitude: number;
}

/**
 * The DISH-03 body: only the conditions that are set. A nearby roll sends the position with its
 * radius and no province, since the radius already decides where.
 */
export function rollRequest(
  filters: RollFilters,
  excludeDishIds: readonly number[],
  position: RollPosition | null,
): RollDishRequestDto {
  const maxPrice = Number(filters.maxPrice);
  const province = filters.province.trim();
  const request: RollDishRequestDto = {};
  if (filters.mealTime) request.mealTime = filters.mealTime;
  if (Number.isFinite(maxPrice) && maxPrice > 0) request.maxPrice = maxPrice;
  if (filters.tagIds.length) request.tagIds = [...filters.tagIds];
  if (excludeDishIds.length)
    request.excludeDishIds = excludeDishIds.slice(-maxExcludedDishes);
  if (filters.nearby && position) {
    request.latitude = Number(position.latitude.toFixed(6));
    request.longitude = Number(position.longitude.toFixed(6));
    request.radiusKm = Number(filters.radiusKm) || 3;
  } else if (province) request.province = province;
  return request;
}

/** A failed roll in words; `exhausted` asks the visitor to loosen the conditions. */
export function rollError(error: unknown): {
  message: string;
  exhausted: boolean;
} {
  if (error instanceof ApiError && error.errorCode === "NO_CANDIDATE")
    return {
      exhausted: true,
      message:
        "Không còn món nào hợp các điều kiện này. Thử đổi bữa, nâng mức giá, bỏ bớt thẻ món hoặc mở rộng bán kính.",
    };
  return { exhausted: false, message: getErrorMessage(error) };
}

export const geolocationMessages = {
  unsupported:
    "Trình duyệt này không lấy được vị trí. Bạn có thể chọn tỉnh/thành thay thế.",
  denied:
    "Bạn chưa cho phép dùng vị trí. Hãy bật quyền vị trí cho trang này, hoặc chọn tỉnh/thành.",
  failed: "Chưa lấy được vị trí hiện tại. Thử lại hoặc chọn tỉnh/thành.",
} as const;
