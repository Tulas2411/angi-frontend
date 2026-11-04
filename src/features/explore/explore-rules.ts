import { ApiError, getErrorMessage } from "@/shared/api/error";
import { money } from "@/shared/format";
import type {
  BrowseDishesQuery,
  BrowseRestaurantsQuery,
  BusinessHourDto,
  DishForm,
  OperatingStatus,
  ReportReasonCode,
  RestaurantCardDto,
  RestaurantSort,
  ReviewDto,
  ReviewSort,
} from "./explore-types";

export const dishPageSize = 12;
export const restaurantPageSize = 12;
export const reviewPageSize = 10;
export const maxReviewImages = 5;
export const maxReviewLength = 2000;

export const dishFormLabels: Record<DishForm, string> = {
  soup: "Món nước",
  dry: "Món khô",
  other: "Món khác",
};

export const dishFormOptions: { value: "" | DishForm; label: string }[] = [
  { value: "", label: "Mọi loại món" },
  { value: "soup", label: dishFormLabels.soup },
  { value: "dry", label: dishFormLabels.dry },
  { value: "other", label: dishFormLabels.other },
];

/** Lower price limits of the dish filters (VND). */
export const dishMinPriceOptions: { value: string; label: string }[] = [
  { value: "", label: "Không giới hạn" },
  { value: "20000", label: "Từ 20.000 ₫" },
  { value: "50000", label: "Từ 50.000 ₫" },
  { value: "100000", label: "Từ 100.000 ₫" },
];

/** Upper price limits of the dish filters (VND). */
export const dishPriceOptions: { value: string; label: string }[] = [
  { value: "", label: "Mọi mức giá" },
  { value: "50000", label: "Dưới 50.000 ₫" },
  { value: "100000", label: "Dưới 100.000 ₫" },
  { value: "200000", label: "Dưới 200.000 ₫" },
];

export const restaurantSortOptions: { value: RestaurantSort; label: string }[] =
  [
    { value: "rating", label: "Đánh giá cao nhất" },
    { value: "newest", label: "Mới nhất" },
  ];

export const priceLevelOptions: { value: string; label: string }[] = [
  { value: "", label: "Mọi mức giá" },
  { value: "1", label: "Bình dân (₫)" },
  { value: "2", label: "Vừa phải (₫₫)" },
  { value: "3", label: "Cao cấp (₫₫₫)" },
  { value: "4", label: "Sang trọng (₫₫₫₫)" },
];

export const ratingFilterOptions: { value: string; label: string }[] = [
  { value: "", label: "Mọi đánh giá" },
  { value: "3", label: "Từ 3 sao" },
  { value: "4", label: "Từ 4 sao" },
  { value: "4.5", label: "Từ 4,5 sao" },
];

export const reviewSortOptions: { value: ReviewSort; label: string }[] = [
  { value: "newest", label: "Mới nhất" },
  { value: "rating_desc", label: "Điểm cao trước" },
  { value: "rating_asc", label: "Điểm thấp trước" },
];

export const reportReasons: { value: ReportReasonCode; label: string }[] = [
  { value: "wrong_info", label: "Thông tin không chính xác" },
  { value: "closed", label: "Quán đã đóng cửa" },
  { value: "spam", label: "Nội dung rác" },
  { value: "offensive", label: "Nội dung xúc phạm" },
  { value: "hygiene", label: "Vệ sinh không đảm bảo" },
  { value: "scam", label: "Lừa đảo" },
  { value: "other", label: "Lý do khác" },
];

export const vnd = (value: number) => money(value);

/** "4,6" with one decimal at most, like the rest of the site. */
export function ratingText(average: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(
    average,
  );
}

export function ratingSummary(average: number, count: number) {
  return count > 0
    ? `${ratingText(average)} sao · ${count} đánh giá`
    : "Chưa có đánh giá";
}

/** "₫₫" for price level 2, or null when the restaurant has none. */
export function priceLevelText(level: number | null) {
  return level && level >= 1 && level <= 4 ? "₫".repeat(level) : null;
}

export function locationText(district: string | null, province: string | null) {
  return [district, province].filter(Boolean).join(", ");
}

export function operatingBadge(
  status: OperatingStatus,
  isOpenNow: boolean,
): { tone: "success" | "warning" | "error" | "neutral"; text: string } {
  if (status === "permanently_closed")
    return { tone: "error", text: "Đã đóng cửa" };
  if (status === "temporarily_closed")
    return { tone: "warning", text: "Tạm đóng cửa" };
  return isOpenNow
    ? { tone: "success", text: "Đang mở cửa" }
    : { tone: "neutral", text: "Ngoài giờ mở cửa" };
}

/**
 * Cloudinary delivery transformations used by the dish detail page. The stage photo keeps the
 * file's own pixel size (no resize, so a small upload is never stretched) and only gets a modern
 * format, automatic quality and a light sharpen; the backdrop is a tiny copy that CSS blurs.
 */
export const dishImageTransforms = {
  stage: "f_auto,q_auto,e_sharpen:80",
  backdrop: "c_limit,w_96,f_auto,q_auto",
} as const;

/**
 * Adds a delivery transformation to a public Cloudinary image URL
 * (`https://res.cloudinary.com/<cloud>/image/upload/<rest>`). Any other URL is returned unchanged.
 */
export function cloudinaryImage(url: string, transformation: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const marker = "/image/upload/";
  const at = parsed.pathname.indexOf(marker);
  if (parsed.hostname !== "res.cloudinary.com" || at < 0 || !transformation)
    return url;
  const split = at + marker.length;
  parsed.pathname = `${parsed.pathname.slice(0, split)}${transformation}/${parsed.pathname.slice(split)}`;
  return parsed.toString();
}

/** The dish's pictures in display order: the cover first, then the other images once each. */
export function dishPictures(coverUrl: string | null, images: string[]) {
  return [...new Set([...(coverUrl ? [coverUrl] : []), ...images])];
}

/** Other dishes of the same restaurant for "Món khác ở quán": available ones first, menu order kept. */
export function otherMenuDishes<T extends { id: number; isAvailable: boolean }>(
  dishes: T[],
  currentDishId: number,
  limit = 8,
) {
  const others = dishes.filter((dish) => dish.id !== currentDishId);
  return [
    ...others.filter((dish) => dish.isAvailable),
    ...others.filter((dish) => !dish.isAvailable),
  ].slice(0, limit);
}

/** Link to a place on Google Maps from its coordinates; no map provider of ours is called. */
export function googleMapsPlaceHref(
  latitude: number | null,
  longitude: number | null,
) {
  if (latitude === null || longitude === null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
const weekdayNames = [
  "Chủ nhật",
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
];

/** Today in Vietnam as `BusinessHour.dayOfWeek` (0 = Sunday … 6 = Saturday). */
export function vietnamWeekday(now = new Date()) {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
  }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/**
 * Today's state for the opening hours card: a closed restaurant or a day off is red, open hours
 * not running now amber, open right now green.
 */
export function todayOpening(
  status: OperatingStatus,
  isOpenNow: boolean,
  hasHoursToday: boolean,
): { tone: "success" | "warning" | "error"; text: string } {
  if (status === "permanently_closed")
    return { tone: "error", text: "Đã đóng cửa" };
  if (status === "temporarily_closed")
    return { tone: "error", text: "Tạm đóng cửa" };
  if (!hasHoursToday) return { tone: "error", text: "Hôm nay nghỉ" };
  return isOpenNow
    ? { tone: "success", text: "Đang mở cửa" }
    : { tone: "warning", text: "Ngoài giờ mở cửa" };
}

/** Monday first; a day without a slot is "Đóng cửa", several slots are joined with " · ". */
export function businessHoursByDay(hours: BusinessHourDto[]) {
  return weekdayOrder.map((day) => {
    const slots = hours
      .filter((hour) => hour.dayOfWeek === day)
      .sort((a, b) => a.openTime.localeCompare(b.openTime))
      .map((hour) => `${hour.openTime}–${hour.closeTime}`);
    return {
      day,
      label: weekdayNames[day],
      text: slots.length ? slots.join(" · ") : "Đóng cửa",
      open: slots.length > 0,
    };
  });
}

/** Average of the five bars: the share (0..1) of reviews for each star, 5 first. */
export function ratingShares(breakdown: Record<string, number>) {
  const total = [1, 2, 3, 4, 5].reduce(
    (sum, star) => sum + (breakdown[String(star)] ?? 0),
    0,
  );
  return [5, 4, 3, 2, 1].map((star) => {
    const count = breakdown[String(star)] ?? 0;
    return { star, count, share: total ? count / total : 0 };
  });
}

export function reviewDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
  }).format(new Date(value));
}

/** List filters kept in the URL, so a search can be shared and the back button works. */
export interface DishFilters {
  q: string;
  province: string;
  form: "" | DishForm;
  /** VND, one of `dishMinPriceOptions`; empty for no lower limit. */
  minPrice: string;
  /** VND, one of `dishPriceOptions`; empty for no upper limit. */
  maxPrice: string;
  /** DISH-01 `tagIds`: any tag of one tag type, every tag type that has a choice. */
  tagIds: number[];
  /** DISH-01 `excludeTagIds`: leave out a dish carrying any of these. */
  excludeTagIds: number[];
}

export const emptyDishFilters: DishFilters = {
  q: "",
  province: "",
  form: "",
  minPrice: "",
  maxPrice: "",
  tagIds: [],
  excludeTagIds: [],
};

const ids = (values: string[]) =>
  [...new Set(values.map(Number))].filter(
    (id) => Number.isInteger(id) && id > 0,
  );

export function dishQueryFromParams(params: URLSearchParams): DishFilters {
  const form = params.get("form");
  const known = (
    options: readonly { value: string }[],
    value: string | null,
  ) => (value && options.some((o) => o.value === value) ? value : "");
  return {
    q: params.get("q") ?? "",
    province: params.get("province") ?? "",
    form: form === "soup" || form === "dry" || form === "other" ? form : "",
    minPrice: known(dishMinPriceOptions, params.get("min")),
    maxPrice: known(dishPriceOptions, params.get("price")),
    tagIds: ids(params.getAll("tag")),
    excludeTagIds: ids(params.getAll("notag")),
  };
}

/** A lower price above the upper one cannot match anything; say so instead of searching. */
export function dishPriceProblem(
  filters: Pick<DishFilters, "minPrice" | "maxPrice">,
) {
  return filters.minPrice &&
    filters.maxPrice &&
    Number(filters.minPrice) >= Number(filters.maxPrice)
    ? "Giá từ phải thấp hơn giá đến."
    : "";
}

export function dishApiQuery(
  filters: DishFilters,
  cursor?: string,
): BrowseDishesQuery {
  return {
    q: filters.q.trim() || undefined,
    province: filters.province.trim() || undefined,
    dishForm: filters.form || undefined,
    minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
    maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
    tagIds: filters.tagIds.length ? filters.tagIds : undefined,
    excludeTagIds: filters.excludeTagIds.length
      ? filters.excludeTagIds
      : undefined,
    cursor,
    limit: dishPageSize,
  };
}

export function dishFiltersHref(filters: DishFilters) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.province.trim()) params.set("province", filters.province.trim());
  if (filters.form) params.set("form", filters.form);
  if (filters.minPrice) params.set("min", filters.minPrice);
  if (filters.maxPrice) params.set("price", filters.maxPrice);
  for (const id of filters.tagIds) params.append("tag", String(id));
  for (const id of filters.excludeTagIds) params.append("notag", String(id));
  const text = params.toString();
  return text ? `/dishes?${text}` : "/dishes";
}

/** How many filters of the panel are set (the search box is not one), for the toggle button. */
export function activeDishFilterCount(filters: DishFilters) {
  return (
    (filters.province.trim() ? 1 : 0) +
    (filters.form ? 1 : 0) +
    (filters.minPrice ? 1 : 0) +
    (filters.maxPrice ? 1 : 0) +
    filters.tagIds.length +
    filters.excludeTagIds.length
  );
}

/**
 * Restaurant filters kept in the URL. The list loads page after page as the traveler scrolls, so
 * no page number is kept (an old `?page=` link starts from the first page).
 */
export function restaurantQueryFromParams(params: URLSearchParams) {
  const sort = params.get("sort");
  const level = params.get("price");
  const rating = params.get("rating");
  return {
    q: params.get("q") ?? "",
    province: params.get("province") ?? "",
    priceLevel: priceLevelOptions.some((o) => o.value === level)
      ? (level ?? "")
      : "",
    minRating: ratingFilterOptions.some((o) => o.value === rating)
      ? (rating ?? "")
      : "",
    openNow: params.get("open") === "1",
    sort: (sort === "newest" ? "newest" : "rating") as RestaurantSort,
  };
}

export type RestaurantFilters = ReturnType<typeof restaurantQueryFromParams>;

export const emptyRestaurantFilters: RestaurantFilters = {
  q: "",
  province: "",
  priceLevel: "",
  minRating: "",
  openNow: false,
  sort: "rating",
};

/** How many filters of the panel are in use (the search text and the order are not counted). */
export function activeRestaurantFilterCount(filters: RestaurantFilters) {
  return (
    (filters.province.trim() ? 1 : 0) +
    (filters.priceLevel ? 1 : 0) +
    (filters.minRating ? 1 : 0) +
    (filters.openNow ? 1 : 0)
  );
}

/** REST-01 query for one page (from 1) of the filtered list. */
export function restaurantApiQuery(
  filters: RestaurantFilters,
  page = 1,
): BrowseRestaurantsQuery {
  return {
    q: filters.q.trim() || undefined,
    province: filters.province.trim() || undefined,
    priceLevel: filters.priceLevel ? Number(filters.priceLevel) : undefined,
    minRating: filters.minRating ? Number(filters.minRating) : undefined,
    openNow: filters.openNow || undefined,
    sort: filters.sort,
    page,
    pageSize: restaurantPageSize,
  };
}

/**
 * The list after the next page arrived. A restaurant already shown is not repeated: when the
 * order moved between two reads (a new rating), the same restaurant can come back on the next page.
 */
export function appendRestaurants(
  shown: readonly RestaurantCardDto[],
  page: readonly RestaurantCardDto[],
) {
  const ids = new Set(shown.map((restaurant) => restaurant.id));
  return [...shown, ...page.filter((restaurant) => !ids.has(restaurant.id))];
}

export function restaurantFiltersHref(filters: RestaurantFilters) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.province.trim()) params.set("province", filters.province.trim());
  if (filters.priceLevel) params.set("price", filters.priceLevel);
  if (filters.minRating) params.set("rating", filters.minRating);
  if (filters.openNow) params.set("open", "1");
  if (filters.sort !== "rating") params.set("sort", filters.sort);
  const text = params.toString();
  return text ? `/restaurants?${text}` : "/restaurants";
}

/** The first star-rating button that was not pressed yet; a review needs 1..5. */
export function reviewProblems(rating: number, content: string) {
  const problems: { rating?: string; content?: string } = {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    problems.rating = "Chọn số sao từ 1 đến 5.";
  if (content.trim().length > maxReviewLength)
    problems.content = `Nội dung tối đa ${maxReviewLength} ký tự.`;
  return problems;
}

/** REV-01 failures by `errorCode`; `settled` means the traveler already reviewed this restaurant. */
export function reviewError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "REVIEW_ALREADY_EXISTS")
    return {
      settled: true,
      message: "Bạn đã đánh giá quán này rồi, mỗi quán chỉ đánh giá một lần.",
    };
  if (code === "RESTAURANT_NOT_FOUND")
    return { settled: false, message: "Quán này không còn hiển thị." };
  return { settled: false, message: getErrorMessage(error) };
}

/** REP-01 failures by `errorCode`; `settled` means a report from this traveler is already waiting. */
export function reportError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "REPORT_ALREADY_PENDING")
    return {
      settled: true,
      message:
        "Báo cáo trước đó của bạn về quán này đang chờ xử lý, chưa thể gửi thêm.",
    };
  if (code === "RESTAURANT_NOT_FOUND")
    return { settled: false, message: "Quán này không còn hiển thị." };
  return { settled: false, message: getErrorMessage(error) };
}

/** The reply of the owner is only shown while it is visible. */
export function visibleReply(review: ReviewDto) {
  return review.reply && review.reply.status === "visible"
    ? review.reply
    : null;
}

/** `/dishes/105` → 105; anything that is not a positive whole number is not a page. */
export function parseEntityId(value: string): number | null {
  return /^[1-9]\d{0,9}$/.test(value) ? Number(value) : null;
}

export { reportProblems } from "@/shared/report-rules";
