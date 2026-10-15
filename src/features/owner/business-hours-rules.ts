import type { BusinessHourDto } from "./restaurant-types";

export const businessDays = [
  { dayOfWeek: 1, label: "Thứ hai" },
  { dayOfWeek: 2, label: "Thứ ba" },
  { dayOfWeek: 3, label: "Thứ tư" },
  { dayOfWeek: 4, label: "Thứ năm" },
  { dayOfWeek: 5, label: "Thứ sáu" },
  { dayOfWeek: 6, label: "Thứ bảy" },
  { dayOfWeek: 0, label: "Chủ nhật" },
] as const;
const dayMinutes = 1440;
const weekMinutes = 7 * dayMinutes;

function minute(time: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function sortBusinessHours(
  hours: readonly BusinessHourDto[],
): BusinessHourDto[] {
  return hours
    .map((hour) => ({ ...hour }))
    .sort(
      (a, b) =>
        a.dayOfWeek - b.dayOfWeek || a.openTime.localeCompare(b.openTime),
    );
}

/** Shape errors are VALIDATION_FAILED; real overlaps are INVALID_BUSINESS_HOURS in BE. */
export function validateBusinessHours(hours: readonly BusinessHourDto[]): {
  errors: Record<string, string>;
  errorCode: "VALIDATION_FAILED" | "INVALID_BUSINESS_HOURS" | null;
} {
  const errors: Record<string, string> = {};
  const intervals: { index: number; start: number; end: number }[] = [];
  hours.forEach((hour, index) => {
    const key = `hours[${index}]`;
    if (
      !Number.isInteger(hour.dayOfWeek) ||
      hour.dayOfWeek < 0 ||
      hour.dayOfWeek > 6
    )
      errors[`${key}.dayOfWeek`] =
        "Thứ trong tuần phải từ Chủ nhật đến Thứ bảy.";
    const open = minute(hour.openTime),
      close = minute(hour.closeTime);
    if (open === null)
      errors[`${key}.openTime`] = "Nhập giờ mở theo dạng HH:mm.";
    if (close === null)
      errors[`${key}.closeTime`] = "Nhập giờ đóng theo dạng HH:mm.";
    if (open !== null && close !== null && open === close)
      errors[`${key}.closeTime`] = "Giờ mở và giờ đóng phải khác nhau.";
    if (
      open !== null &&
      close !== null &&
      open !== close &&
      !errors[`${key}.dayOfWeek`]
    ) {
      const start = hour.dayOfWeek * dayMinutes + open;
      intervals.push({
        index,
        start,
        end:
          hour.dayOfWeek * dayMinutes + close + (close < open ? dayMinutes : 0),
      });
    }
  });
  const invalidShape = Object.keys(errors).length > 0;
  let overlap = false;
  intervals.forEach((a, position) => {
    for (const b of intervals.slice(position + 1)) {
      if (
        [-weekMinutes, 0, weekMinutes].some(
          (shift) => a.start < b.end + shift && b.start + shift < a.end,
        )
      ) {
        overlap = true;
        const message =
          "Khung giờ chồng lên khung khác, kể cả phần qua nửa đêm.";
        errors[`hours[${a.index}].openTime`] = message;
        errors[`hours[${b.index}].openTime`] = message;
      }
    }
  });
  return {
    errors,
    errorCode: invalidShape
      ? "VALIDATION_FAILED"
      : overlap
        ? "INVALID_BUSINESS_HOURS"
        : null,
  };
}

export function businessHourFieldErrors(
  errors?: Record<string, string[]>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors ?? {}).map(([key, messages]) => [
      key
        .replace(/^Hours/i, "hours")
        .replace(/\.OpenTime$/i, ".openTime")
        .replace(/\.CloseTime$/i, ".closeTime")
        .replace(/\.DayOfWeek$/i, ".dayOfWeek"),
      messages.join(" "),
    ]),
  );
}

/** Mirrors the BE schedule calculation at UTC+7; operating/moderation statuses stay separate. */
export function isOpenAt(
  hours: readonly BusinessHourDto[],
  now: Date,
): boolean {
  const vietnam = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const point =
    vietnam.getUTCDay() * dayMinutes +
    vietnam.getUTCHours() * 60 +
    vietnam.getUTCMinutes();
  return hours.some((hour) => {
    const open = minute(hour.openTime),
      close = minute(hour.closeTime);
    if (open === null || close === null || open === close) return false;
    const start = hour.dayOfWeek * dayMinutes + open;
    const end =
      hour.dayOfWeek * dayMinutes + close + (close < open ? dayMinutes : 0);
    return [point - weekMinutes, point, point + weekMinutes].some(
      (time) => time >= start && time < end,
    );
  });
}
