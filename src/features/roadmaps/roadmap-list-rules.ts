import { dateLabel } from "@/shared/format";
import { formatVndInput, originModeLabels } from "./roadmap-rules";
import type { RoadmapSummaryDto } from "./roadmap-types";

/** Three cards per row on desktop; RM-02 allows 1–100 per page. */
export const roadmapListPageSize = 9;

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

/** Same rule as `RoadmapDetail.budget.isOverBudget`: totalEstimatedCost > budgetAmount. */
export function isOverBudget(summary: RoadmapSummaryDto) {
  return (
    summary.budgetAmount !== null &&
    summary.totalEstimatedCost > summary.budgetAmount
  );
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
