import { ApiError, getErrorMessage } from "@/shared/api/error";
import { dateLabel } from "@/shared/format";
import { formatVndInput, originModeLabels } from "./roadmap-rules";
import type { RoadmapSummaryDto } from "./roadmap-types";

/** Twelve fill whole rows of four, three and two cards; RM-02 allows 1–100 per page. */
export const roadmapListPageSize = 12;

/** `?page=` from the URL: a positive integer, anything else is the first page. */
export function parseRoadmapPage(value: string | string[] | undefined): number {
  const text = Array.isArray(value) ? value[0] : value;
  const page = text && /^\d{1,6}$/.test(text) ? Number(text) : 1;
  return page >= 1 ? page : 1;
}

/** `endDate` is `startDate + numDays − 1` and null without a start date (RoadmapSummary). */
export function roadmapDateRange(summary: RoadmapSummaryDto) {
  if (!summary.startDate) return "Chưa chọn ngày đi";
  return summary.endDate && summary.endDate !== summary.startDate
    ? `${dateLabel(summary.startDate)} – ${dateLabel(summary.endDate)}`
    : dateLabel(summary.startDate);
}

const dayParts = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
};

/** The card's short dates: "10 – 12 thg 10, 2026", "30 thg 10 – 2 thg 11, 2026". */
export function roadmapShortRange(summary: RoadmapSummaryDto) {
  if (!summary.startDate) return "Chưa chọn ngày đi";
  const start = dayParts(summary.startDate);
  const end = summary.endDate ? dayParts(summary.endDate) : start;
  if (start.year !== end.year)
    return `${start.day} thg ${start.month}, ${start.year} – ${end.day} thg ${end.month}, ${end.year}`;
  if (start.month !== end.month)
    return `${start.day} thg ${start.month} – ${end.day} thg ${end.month}, ${end.year}`;
  if (start.day !== end.day)
    return `${start.day} – ${end.day} thg ${end.month}, ${end.year}`;
  return `${start.day} thg ${start.month}, ${start.year}`;
}

/** Today in Vietnam as `yyyy-mm-dd`. */
export function vietnamToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(
    now,
  );
}

/** The cover badge: how soon the trip starts, or that it is under way; null once it is over. */
export function roadmapCountdown(
  summary: RoadmapSummaryDto,
  today = vietnamToday(),
): string | null {
  if (!summary.startDate) return null;
  const end = summary.endDate ?? summary.startDate;
  const days = Math.round(
    (Date.parse(`${summary.startDate}T00:00:00Z`) -
      Date.parse(`${today}T00:00:00Z`)) /
      86400000,
  );
  if (days > 1) return `${days} ngày tới`;
  if (days === 1) return "Ngày mai";
  if (days === 0) return "Hôm nay";
  return today <= end ? "Đang diễn ra" : null;
}

/**
 * RM-05 failures by `errorCode`. `gone`: ROADMAP_NOT_FOUND, the roadmap was already deleted (in
 * another tab) or is not the caller's, so the list is read again either way.
 */
export function deleteRoadmapError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "ROADMAP_NOT_FOUND")
    return {
      gone: true,
      message: "Lộ trình này không còn nữa (có thể đã được xóa ở nơi khác).",
    };
  return { gone: false, message: getErrorMessage(error) };
}

/** The page to show after a deletion: the previous one when the last card of a page went away. */
export function pageAfterDelete(page: number, itemsOnPage: number) {
  return itemsOnPage <= 1 && page > 1 ? page - 1 : page;
}

/** Same rule as `RoadmapDetail.budget.isOverBudget`: totalEstimatedCost > budgetAmount. */
export function isOverBudget(summary: RoadmapSummaryDto) {
  return (
    summary.budgetAmount !== null &&
    summary.totalEstimatedCost > summary.budgetAmount
  );
}

/** Hoan Kiem lake, shown while a roadmap has no dish yet (RM-02/RM-03 give no cover then). */
export const emptyRoadmapCover = "/assets/roadmap-cover-hanoi.webp";

/**
 * The cover of a roadmap card or page: the backend's `coverUrl` (the first dish's photo), or the
 * Hanoi photo while the roadmap has no dish. A roadmap whose first dish has no photo keeps the
 * placeholder, as before.
 */
export function roadmapCover(summary: RoadmapSummaryDto) {
  if (summary.coverUrl) return summary.coverUrl;
  return summary.itemCount === 0 ? emptyRoadmapCover : undefined;
}

export const roadmapItemsLabel = (itemCount: number) =>
  itemCount > 0 ? `${itemCount} món` : "Chưa có món";

export const vnd = (amount: number) => formatVndInput(String(amount));

/** Where the roadmap starts; null when the traveler gave no origin. */
export function roadmapOriginText(summary: RoadmapSummaryDto): string | null {
  if (summary.originMode === "none") return null;
  if (summary.originMode === "gps") return originModeLabels.gps;
  return summary.originLabel?.trim() || "Điểm đã chấm trên bản đồ";
}
