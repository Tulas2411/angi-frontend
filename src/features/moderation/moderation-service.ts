import { api } from "@/shared/api/client";
import type {
  ListReportsQuery,
  ReportDetailDto,
  ReportDto,
  ReportsPageDto,
  ReportStatus,
  ResolveReportRequestDto,
} from "./moderation-types";

/**
 * MOD-RP1..MOD-RP4 report queue.
 *
 * The endpoints live behind the same-origin proxy (`/api/backend/mod/reports`),
 * so the moderator's access token never reaches the browser.
 */
export interface ModerationReportsService {
  /** MOD-RP1: one page of the report queue of the selected target type. */
  list(query: ListReportsQuery): Promise<ReportsPageDto>;
  /** MOD-RP2: report evidence, its target and the other open reports on it. */
  detail(reportId: number): Promise<ReportDetailDto>;
  /** MOD-RP3: exclusively assigns a pending report to the caller. */
  claim(reportId: number): Promise<ReportDto>;
  /** MOD-RP4: concludes the report and applies the action in one transaction. */
  resolve(
    reportId: number,
    request: ResolveReportRequestDto,
  ): Promise<ReportDto>;
}

const base = "mod/reports";

export const moderationReportsService: ModerationReportsService = {
  list: (query) => {
    const params = new URLSearchParams();
    params.set("targetType", query.targetType);
    if (query.status) params.set("status", query.status);
    if (query.reasonCode) params.set("reasonCode", query.reasonCode);
    if (query.targetId !== undefined)
      params.set("targetId", String(query.targetId));
    if (query.page !== undefined) params.set("page", String(query.page));
    if (query.pageSize !== undefined)
      params.set("pageSize", String(query.pageSize));
    return api.get<ReportsPageDto>(`${base}?${params.toString()}`);
  },
  detail: (reportId) => api.get<ReportDetailDto>(`${base}/${reportId}`),
  claim: (reportId) => api.post<ReportDto>(`${base}/${reportId}/claim`),
  resolve: (reportId, request) =>
    api.post<ReportDto>(`${base}/${reportId}/resolve`, request),
};

/**
 * Một báo cáo còn mở khi chưa có kết luận. BE chỉ nhận MOD-RP4 cho báo cáo
 * đang mở, nên đơn đã giải quyết hoặc đã bác bỏ thì không có nút bác bỏ.
 */
export function isReportOpen(status: ReportStatus): boolean {
  return status === "pending" || status === "in_review";
}

/** Báo cáo đã có kết luận thì không hiển thị nút bác bỏ. */
export function canDismissReport(status: ReportStatus): boolean {
  return isReportOpen(status);
}

/**
 * Màu của badge trạng thái. Đơn đã bác bỏ dùng màu đỏ (đã loại bỏ) chứ
 * không dùng màu xanh lá như đơn đã giải quyết.
 */
export function reportStatusTone(
  status: ReportStatus,
): "neutral" | "success" | "error" | "warning" {
  if (status === "pending") return "warning";
  if (status === "in_review") return "neutral";
  if (status === "dismissed") return "error";
  return "success";
}

/** The action a moderator picks for a report of the given target type. */
export function conclusionActions(
  targetType: "restaurant" | "blog",
): { value: string; label: string }[] {
  if (targetType === "restaurant")
    return [
      { value: "none", label: "Không ẩn, chỉ ghi nhận" },
      { value: "hide_restaurant", label: "Ẩn nhà hàng" },
      { value: "suspend_restaurant", label: "Tạm khóa nhà hàng" },
    ];
  return [
    { value: "none", label: "Không ẩn, chỉ ghi nhận" },
    { value: "hide_blog", label: "Ẩn bài viết" },
    { value: "remove_blog", label: "Gỡ bài viết" },
  ];
}
