import { api } from "@/shared/api/client";
import type {
  DashboardInterval,
  DashboardMetric,
  DashboardSummaryDto,
  DashboardTimeSeriesDto,
  DashboardTopDto,
  DashboardTopType,
  OutboxPageDto,
  OutboxQuery,
} from "./dashboard-types";

export interface DateRange {
  /** `yyyy-mm-dd`, inclusive. */
  from: string;
  to: string;
}

/** F-63 through the same-origin proxy (Admin sessions only, GET only). */
export interface DashboardService {
  /** ADM-D1. */
  summary(range: DateRange): Promise<DashboardSummaryDto>;
  /** ADM-D2. */
  timeseries(
    metric: DashboardMetric,
    range: DateRange,
    interval: DashboardInterval,
  ): Promise<DashboardTimeSeriesDto>;
  /** ADM-D3. */
  top(type: DashboardTopType, limit: number): Promise<DashboardTopDto>;
  /** OPS-01. */
  outbox(query: OutboxQuery): Promise<OutboxPageDto>;
}

const qs = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== "") params.set(key, String(value));
  const text = params.toString();
  return text ? `?${text}` : "";
};

export const dashboardService: DashboardService = {
  summary: (range) =>
    api.get<DashboardSummaryDto>(`admin/dashboard/summary${qs({ ...range })}`),
  timeseries: (metric, range, interval) =>
    api.get<DashboardTimeSeriesDto>(
      `admin/dashboard/timeseries${qs({ metric, ...range, interval })}`,
    ),
  top: (type, limit) =>
    api.get<DashboardTopDto>(`admin/dashboard/top${qs({ type, limit })}`),
  outbox: (query) =>
    api.get<OutboxPageDto>(
      `admin/outbox${qs({
        status: query.status,
        eventType: query.eventType,
        page: query.page,
        pageSize: query.pageSize,
      })}`,
    ),
};
