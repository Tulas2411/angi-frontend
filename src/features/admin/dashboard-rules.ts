import { ApiError, getErrorMessage } from "@/shared/api/error";
import type { DateRange } from "./dashboard-service";
import type { DashboardInterval, DashboardMetric } from "./dashboard-types";

/** The ranges offered above the dashboard, in days ending today (Vietnam). */
export const rangePresets = [
  { days: 7, label: "7 ngày" },
  { days: 30, label: "30 ngày" },
  { days: 90, label: "90 ngày" },
  { days: 365, label: "12 tháng" },
] as const;

/** Today in Vietnam as `yyyy-mm-dd`. */
export function vietnamDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(
    now,
  );
}

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** The last `days` days, today included: 30 days → from = today − 29. */
export function rangeOf(days: number, today = vietnamDate()): DateRange {
  return { from: addDays(today, -(days - 1)), to: today };
}

/** Days in a range, both ends included. */
export function rangeDays(range: DateRange) {
  return (
    Math.round(
      (Date.parse(`${range.to}T00:00:00Z`) -
        Date.parse(`${range.from}T00:00:00Z`)) /
        86400000,
    ) + 1
  );
}

/** The bucket that keeps a chart readable: days up to a month, weeks up to 4 months, else months. */
export function defaultInterval(range: DateRange): DashboardInterval {
  const days = rangeDays(range);
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

/** ADM-D2 refuses `interval=day` over more than 366 days (validator). */
export const intervalAllowed = (
  interval: DashboardInterval,
  range: DateRange,
) => interval !== "day" || rangeDays(range) - 1 <= 366;

export const metricOptions: { value: DashboardMetric; label: string }[] = [
  { value: "new_users", label: "Người dùng mới" },
  { value: "new_restaurants", label: "Nhà hàng mới" },
  { value: "roadmaps", label: "Lộ trình được tạo" },
  { value: "blogs", label: "Bài cẩm nang" },
  { value: "reports", label: "Báo cáo vi phạm" },
  { value: "feedbacks", label: "Lượt thích / không thích món" },
  { value: "dish_rolls", label: "Lượt quay món" },
];

export const intervalOptions: { value: DashboardInterval; label: string }[] = [
  { value: "day", label: "Theo ngày" },
  { value: "week", label: "Theo tuần" },
  { value: "month", label: "Theo tháng" },
];

export const roleLabels: Record<string, string> = {
  TRAVELER: "Thực khách",
  RESTAURANT_OWNER: "Chủ nhà hàng",
  MOD: "Mod",
  ADMIN: "Quản trị viên",
};
export const userStatusLabels: Record<string, string> = {
  pending_verification: "Chờ xác minh email",
  active: "Đang hoạt động",
  suspended: "Tạm đình chỉ",
  banned: "Bị cấm",
  deactivated: "Đã vô hiệu hóa",
};
export const verificationLabels: Record<string, string> = {
  unverified: "Chưa xác minh",
  pending: "Chờ duyệt",
  verified: "Đã xác minh",
  rejected: "Bị từ chối",
};
export const moderationLabels: Record<string, string> = {
  visible: "Đang hiển thị",
  hidden: "Đã ẩn",
  suspended: "Bị đình chỉ",
};
export const outboxStatusLabels: Record<string, string> = {
  pending: "Đang chờ gửi",
  processing: "Đang gửi",
  dead: "Gửi thất bại",
};
export const eventTypeLabels: Record<string, string> = {
  DISH_UPSERTED: "Cập nhật món",
  DISH_DEACTIVATED: "Ngừng bán món",
  FEEDBACK_CREATED: "Đánh giá món",
};

/**
 * A breakdown (`byRole`, `byStatus`…) as rows for the bar list: labelled, the known keys in
 * their order first, the largest first among the rest, zero rows kept so the picture is honest.
 */
export function breakdownRows(
  counts: Record<string, number>,
  labels: Record<string, string>,
) {
  const known = Object.keys(labels);
  const keys = [
    ...known,
    ...Object.keys(counts)
      .filter((key) => !known.includes(key))
      .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0)),
  ];
  const total = keys.reduce((sum, key) => sum + (counts[key] ?? 0), 0);
  return keys.map((key) => {
    const value = counts[key] ?? 0;
    return {
      key,
      label: labels[key] ?? key,
      value,
      share: total ? value / total : 0,
    };
  });
}

export const count = (value: number) => value.toLocaleString("vi-VN");

/** "42%" of a part in a whole; "—" when the whole is empty. */
export function percent(part: number, whole: number) {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

/** A round top for the y axis and the gridlines under it (0, step, 2·step…). */
export function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { max: ticks, step: 1 };
  const rough = max / ticks;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ??
    10 * power;
  return { max: Math.ceil(max / step) * step, step };
}

/** The label of a bucket on the x axis and in the tooltip. */
export function bucketLabel(
  bucket: string,
  interval: DashboardInterval,
  long = false,
) {
  const [year, month, day] = bucket.split("-").map(Number);
  if (interval === "month")
    return long
      ? `Tháng ${month}/${year}`
      : `T${month}/${String(year).slice(2)}`;
  if (interval === "week")
    return long ? `Tuần từ ${day}/${month}/${year}` : `${day}/${month}`;
  return long ? `${day}/${month}/${year}` : `${day}/${month}`;
}

/** A score of ADM-D3: likes are whole numbers, a rating keeps one decimal. */
export function topScore(
  type: "dishes" | "restaurants" | "blogs",
  score: number,
) {
  if (type === "restaurants")
    return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(score)} ★`;
  return `${count(Math.round(score))} lượt thích`;
}

/** "02/11/2026 19:30" in Vietnam time. */
export function dateTime(value: string | null, empty = "—") {
  if (!value) return empty;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Bangkok",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

/** "1/11/2026 – 30/11/2026" for the range above the dashboard. */
export function rangeLabel(range: DateRange) {
  const show = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return `${day}/${month}/${year}`;
  };
  return `${show(range.from)} – ${show(range.to)}`;
}

/**
 * ADM-D1..ADM-D3 / OPS-01 failures. A 404 without a code means the backend build has no
 * dashboard yet (the endpoints are on BE branch feat/ANGI-189-admin-dashboard until it merges).
 */
export function dashboardError(error: unknown) {
  if (error instanceof ApiError) {
    if (
      error.status === 404 &&
      (error.errorCode === "HTTP_404" || error.errorCode === "ROUTE_NOT_FOUND")
    )
      return "Máy chủ chưa có chức năng thống kê này. Hãy cập nhật backend có ADM-D1..D3 và OPS-01 rồi tải lại.";
    if (error.errorCode === "VALIDATION_FAILED")
      return "Khoảng thời gian chưa hợp lệ (tối đa 366 ngày khi xem theo ngày).";
    if (error.errorCode === "FORBIDDEN")
      return "Chỉ quản trị viên được xem bảng thống kê.";
  }
  return getErrorMessage(error);
}
