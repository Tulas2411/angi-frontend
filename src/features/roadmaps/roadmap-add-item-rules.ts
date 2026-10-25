import { ApiError, getErrorMessage } from "@/shared/api/error";
import { provinceNameKey } from "@/shared/locations/provinces";
import { budgetMaxDigits } from "./roadmap-rules";
import type {
  AddRoadmapItemRequestDto,
  DishCardDto,
  MealSlot,
  RoadmapDayDto,
  RoadmapSuggestionsQuery,
} from "./roadmap-types";

/** Meals in the order of a day; `late_night` is last. */
export const mealSlots: MealSlot[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "late_night",
];

/** RM-06 allows 1..50 per page. */
export const suggestionsPageSize = 12;

export interface SuggestionFilters {
  province: string;
  q: string;
  /** Digits only, as the VND input keeps them. */
  maxPrice: string;
}

export function validateSuggestionFilters(
  filters: SuggestionFilters,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!filters.province.trim())
    errors.province = "Chọn tỉnh / thành phố bạn muốn tìm món.";
  if (filters.maxPrice && filters.maxPrice.length > budgetMaxDigits)
    errors.maxPrice = "Giá tối đa quá lớn.";
  return errors;
}

/** RM-06 query from the form; empty filters are left out, coordinates only as a pair. */
export function buildSuggestionsQuery(
  filters: SuggestionFilters,
  options: {
    dayId: number;
    gps?: { latitude: number; longitude: number };
    cursor?: string | null;
  },
): RoadmapSuggestionsQuery {
  const query: RoadmapSuggestionsQuery = {
    province: filters.province.trim(),
    dayId: options.dayId,
    limit: suggestionsPageSize,
  };
  const text = filters.q.trim();
  if (text) query.q = text;
  if (filters.maxPrice) query.maxPrice = Number(filters.maxPrice);
  if (options.gps) {
    query.lat = options.gps.latitude;
    query.lng = options.gps.longitude;
  }
  if (options.cursor) query.cursor = options.cursor;
  return query;
}

/** The query string of `GET roadmaps/{id}/suggestions`; `undefined` values are never sent. */
export function suggestionsQueryString(query: RoadmapSuggestionsQuery) {
  const params = new URLSearchParams();
  params.set("province", query.province);
  if (query.dayId !== undefined) params.set("dayId", String(query.dayId));
  if (query.mealSlot) params.set("mealSlot", query.mealSlot);
  if (query.q) params.set("q", query.q);
  if (query.maxPrice !== undefined)
    params.set("maxPrice", String(query.maxPrice));
  if (query.lat !== undefined && query.lng !== undefined) {
    params.set("lat", String(query.lat));
    params.set("lng", String(query.lng));
  }
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  return params.toString();
}

/** RM-07 body for a suggested dish: the reco request id lets the backend link the choice. */
export function buildAddItemRequest(
  dish: Pick<DishCardDto, "id">,
  mealSlot: MealSlot,
  requestId: string,
): AddRoadmapItemRequestDto {
  return { dishId: dish.id, mealSlot, recoRequestId: requestId };
}

/** The province most of the roadmap's restaurants are in; empty when nothing is known yet. */
export function mostCommonProvince(itinerary: readonly RoadmapDayDto[]) {
  const counts = new Map<string, number>();
  for (const day of itinerary)
    for (const item of day.items) {
      const name = item.dish.restaurant.provinceName?.trim();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  let best = "";
  let bestCount = 0;
  for (const [name, count] of counts)
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  return best;
}

/**
 * The province a free text (the roadmap title, e.g. "Đi chơi Hà Nội") names, as written in the
 * catalog; empty when none is named. Matches whole words without accents and prefers the longest name.
 */
export function provinceFromText(
  text: string,
  catalog: readonly { name: string }[],
) {
  const words = (value: string) =>
    ` ${provinceNameKey(value)
      .replace(/[^a-z0-9]+/g, " ")
      .trim()} `;
  const haystack = words(text);
  let best = "";
  let bestLength = 0;
  for (const { name } of catalog) {
    const key = words(name);
    if (key.trim() && haystack.includes(key) && key.length > bestLength) {
      best = name;
      bestLength = key.length;
    }
  }
  return best;
}

/** First of breakfast, lunch and dinner the day has no dish for; otherwise a snack. */
export function nextMealSlot(day: Pick<RoadmapDayDto, "items">): MealSlot {
  const used = new Set(day.items.map((item) => item.mealSlot));
  return (
    (["breakfast", "lunch", "dinner"] as const).find(
      (slot) => !used.has(slot),
    ) ?? "snack"
  );
}

/** RM-06 failures by `errorCode`; `expired` means the cursor list must be loaded again. */
export function suggestionsError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "INVALID_CURSOR")
    return {
      expired: true,
      message: "Danh sách gợi ý đã hết hạn. Hãy tải lại để xem tiếp.",
    };
  if (code === "ROADMAP_NOT_FOUND")
    return {
      expired: false,
      message: "Không tìm thấy lộ trình này hoặc lộ trình không thuộc về bạn.",
    };
  if (code === "VALIDATION_FAILED")
    return {
      expired: false,
      message:
        "Bộ lọc chưa hợp lệ. Kiểm tra tỉnh / thành phố và giá tối đa rồi thử lại.",
    };
  return { expired: false, message: getErrorMessage(error) };
}

/** RM-07 failures by `errorCode`; `unavailable` means the dish can no longer be added. */
export function addItemError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "DISH_NOT_AVAILABLE")
    return {
      unavailable: true,
      message:
        "Món này không còn khả dụng (đã hết, ngừng bán hoặc quán đang ẩn). Hãy chọn món khác.",
    };
  if (code === "DAY_NOT_FOUND")
    return {
      unavailable: false,
      message:
        "Không tìm thấy ngày này trong lộ trình. Hãy tải lại trang rồi thử lại.",
    };
  if (code === "ROADMAP_NOT_FOUND")
    return {
      unavailable: false,
      message: "Không tìm thấy lộ trình này hoặc lộ trình không thuộc về bạn.",
    };
  if (code === "VALIDATION_FAILED")
    return {
      unavailable: false,
      message: "Thông tin món chưa hợp lệ. Hãy thử chọn lại món.",
    };
  return { unavailable: false, message: getErrorMessage(error) };
}
