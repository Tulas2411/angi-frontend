import { classifyGpsError, type GpsProblem } from "./roadmap-rules";
import type {
  MealSlot,
  RoadmapBudgetDto,
  RoadmapDayDto,
  RoadmapDishDto,
  RoadmapItemDto,
  RoadmapRouteDto,
  RoadmapRouteLegDto,
  RoadmapSummaryDto,
} from "./roadmap-types";

export { classifyGpsError, type GpsProblem };

export const mealSlotLabels: Record<MealSlot, string> = {
  breakfast: "Bữa sáng",
  lunch: "Bữa trưa",
  dinner: "Bữa tối",
  snack: "Ăn vặt",
  late_night: "Ăn khuya",
};

/** `/roadmaps/{id}`: a positive integer id, anything else is not a roadmap. */
export function parseRoadmapId(value: string): number | null {
  return /^[1-9]\d{0,14}$/.test(value) ? Number(value) : null;
}

/** `?day=` from the URL: a positive day number, anything else is the first day. */
export function parseDayParam(value: string | string[] | undefined): number {
  const text = Array.isArray(value) ? value[0] : value;
  return text && /^[1-9]\d{0,2}$/.test(text) ? Number(text) : 1;
}

/** The three tabs of RoadmapDetail (Overview, Itinerary, Budget). */
export type DetailTab = "overview" | "itinerary" | "budget";
export const detailTabs: { value: DetailTab; label: string }[] = [
  { value: "overview", label: "Tổng quan" },
  { value: "itinerary", label: "Lịch trình" },
  { value: "budget", label: "Ngân sách" },
];

/** `?tab=` from the URL; the itinerary is the default, as in the design. */
export function parseTabParam(value: string | string[] | undefined): DetailTab {
  const text = Array.isArray(value) ? value[0] : value;
  return detailTabs.find((tab) => tab.value === text)?.value ?? "itinerary";
}

const longDate = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Asia/Bangkok",
});
const weekdayShort = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const dateOnly = (date: string) => new Date(`${date}T00:00:00+07:00`);

/** `Thứ Sáu, 25 tháng 9`; without a start date the day keeps its number. */
export function dayTitle(day: Pick<RoadmapDayDto, "date" | "dayNumber">) {
  return day.date
    ? longDate.format(dateOnly(day.date))
    : `Ngày ${day.dayNumber}`;
}

/** `T6 25/9` for the day list; `Ngày 3` without a date. */
export function dayShortLabel(day: Pick<RoadmapDayDto, "date" | "dayNumber">) {
  if (!day.date) return `Ngày ${day.dayNumber}`;
  const [, month, date] = day.date.split("-").map(Number);
  const weekday = weekdayShort[new Date(`${day.date}T00:00:00Z`).getUTCDay()];
  return `${weekday} ${date}/${month}`;
}

/** The dishes of a day on one line (`Phở · Bánh mì · Cơm tấm`). */
export function dayDishSummary(items: readonly RoadmapItemDto[]) {
  return items.length
    ? items.map((item) => item.dish.name).join(" · ")
    : "Chưa có món";
}

export interface MealGroup {
  mealSlot: MealSlot;
  items: RoadmapItemDto[];
}

/** Items of a day grouped by meal; they already come sorted by meal slot then `sortOrder`. */
export function groupByMeal(items: readonly RoadmapItemDto[]): MealGroup[] {
  const groups: MealGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.mealSlot === item.mealSlot) last.items.push(item);
    else groups.push({ mealSlot: item.mealSlot, items: [item] });
  }
  return groups;
}

const kilometers = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

/** 850 → `850 m`, 2350 → `2,35 km`. */
export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${kilometers.format(meters / 1000)} km`;
}

/** 540 → `9 phút`, 4500 → `1 giờ 15 phút`; never shows `0 phút` for a real leg. */
export function formatDuration(seconds: number) {
  if (seconds <= 0) return "0 phút";
  const total = Math.max(1, Math.round(seconds / 60));
  if (total < 60) return `${total} phút`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
}

const ratingFormat = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
export const formatRating = (rating: number) => ratingFormat.format(rating);

const isCoordinate = (value: number | null): value is number =>
  value !== null && Number.isFinite(value);

export interface GoogleMapsLink {
  url: string;
  /** Stops in the link; Google Maps accepts an origin, 9 waypoints and a destination. */
  stops: number;
  truncated: boolean;
}

const googleMapsMaxStops = 10;

/**
 * "Mở trên Google Maps" for one day. It is built by the app, in item order, from the
 * restaurant coordinates (RM-03 note): a pinned origin is the start, `gps` and `none`
 * leave the start to Google Maps, and items without coordinates are skipped.
 */
export function googleMapsDayLink(
  overview: Pick<
    RoadmapSummaryDto,
    "originMode" | "originLatitude" | "originLongitude"
  >,
  items: readonly RoadmapItemDto[],
): GoogleMapsLink | null {
  const all = items.flatMap(({ dish }) =>
    isCoordinate(dish.restaurant.latitude) &&
    isCoordinate(dish.restaurant.longitude)
      ? [`${dish.restaurant.latitude},${dish.restaurant.longitude}`]
      : [],
  );
  if (!all.length) return null;
  const stops = all.slice(0, googleMapsMaxStops);
  const params = new URLSearchParams({ api: "1" });
  if (
    overview.originMode === "pinned" &&
    isCoordinate(overview.originLatitude) &&
    isCoordinate(overview.originLongitude)
  )
    params.set(
      "origin",
      `${overview.originLatitude},${overview.originLongitude}`,
    );
  params.set("destination", stops[stops.length - 1]);
  if (stops.length > 1) params.set("waypoints", stops.slice(0, -1).join("|"));
  params.set("travelmode", "driving");
  return {
    url: `https://www.google.com/maps/dir/?${params}`,
    stops: stops.length,
    truncated: all.length > stops.length,
  };
}

/**
 * RM-14 is asked only when the day has legs to show: two or more dishes, or one dish and an
 * origin (a pinned point, or the device position the traveler allowed for a `gps` roadmap).
 * Empty days never call it, which also spares the route provider.
 */
export function wantsDayRoute(
  overview: Pick<RoadmapSummaryDto, "originMode">,
  items: readonly RoadmapItemDto[],
  hasGpsOrigin: boolean,
) {
  if (items.length >= 2) return true;
  return (
    items.length === 1 &&
    (overview.originMode === "pinned" ||
      (overview.originMode === "gps" && hasGpsOrigin))
  );
}

/** The leg that ends at each item of the day, by item id. */
export function legsByTarget(route: RoadmapRouteDto) {
  return new Map<number, RoadmapRouteLegDto>(
    route.legs.map((leg) => [leg.toItemId, leg]),
  );
}

/**
 * `Khách sạn Sala → Bún bò Huế`, `Bún bò Huế → Mì Quảng` (Figma "Connection 1 → 2"): the
 * leg starts at the origin when `fromItemId` is null, named by the pinned label if any.
 */
export function legEndpoints(
  leg: RoadmapRouteLegDto,
  items: readonly RoadmapItemDto[],
  originLabel: string | null,
) {
  const name = (itemId: number) =>
    items.find((item) => item.id === itemId)?.dish.name ?? "Món";
  const from =
    leg.fromItemId === null
      ? originLabel?.trim() || "Điểm xuất phát"
      : name(leg.fromItemId);
  return `${from} → ${name(leg.toItemId)}`;
}

/** "Món đã ngừng bán" for any dish that is not active (RoadmapDish.status), else a sold-out note. */
export function dishNotice(dish: RoadmapDishDto): string | null {
  if (dish.status !== "active") return "Món đã ngừng bán";
  return dish.isAvailable ? null : "Tạm hết món";
}

export function budgetShare(budget: RoadmapBudgetDto) {
  const limit = budget.budgetAmount;
  const over = limit !== null && budget.totalEstimatedCost > limit;
  return {
    percent:
      limit !== null && limit > 0
        ? Math.min(100, Math.round((budget.totalEstimatedCost / limit) * 100))
        : 0,
    over,
    overBy: over && limit !== null ? budget.totalEstimatedCost - limit : 0,
  };
}

/** Guidance when the device position cannot be read for the first leg of a `gps` roadmap. */
export const gpsRouteMessages: Record<GpsProblem, string> = {
  denied:
    "Trình duyệt đang chặn vị trí của trang này. Bấm biểu tượng ổ khóa cạnh thanh địa chỉ, đặt Vị trí thành Cho phép rồi thử lại. Các chặng giữa các quán vẫn được tính.",
  insecure:
    "Trình duyệt chỉ hỏi quyền vị trí khi trang chạy qua https hoặc http://localhost. Các chặng giữa các quán vẫn được tính.",
  unavailable:
    "Thiết bị chưa cung cấp được vị trí. Hãy bật dịch vụ vị trí của hệ điều hành rồi thử lại. Các chặng giữa các quán vẫn được tính.",
  timeout:
    "Quá thời gian chờ vị trí. Hãy thử lại. Các chặng giữa các quán vẫn được tính.",
};
