import { describe, expect, it } from "vitest";
import {
  breakdownRows,
  bucketLabel,
  dashboardError,
  defaultInterval,
  intervalAllowed,
  niceScale,
  percent,
  rangeDays,
  rangeOf,
  roleLabels,
  topScore,
  vietnamDate,
} from "@/features/admin/dashboard-rules";
import { dashboardService } from "@/features/admin/dashboard-service";
import { adminDashboardOperation } from "@/shared/api/admin-proxy";
import { ApiError } from "@/shared/api/error";

describe("F-63 date range and buckets", () => {
  it("ends a range today in Vietnam, both ends included", () => {
    // 2026-11-02 18:00 UTC is already 3 November in Vietnam.
    expect(vietnamDate(new Date("2026-11-02T18:00:00Z"))).toBe("2026-11-03");
    expect(rangeOf(30, "2026-11-03")).toEqual({
      from: "2026-10-05",
      to: "2026-11-03",
    });
    expect(rangeDays(rangeOf(30, "2026-11-03"))).toBe(30);
    expect(rangeOf(7, "2026-03-02")).toEqual({
      from: "2026-02-24",
      to: "2026-03-02",
    });
  });

  it("picks days up to a month, weeks up to four months, then months", () => {
    expect(defaultInterval(rangeOf(30, "2026-11-03"))).toBe("day");
    expect(defaultInterval(rangeOf(90, "2026-11-03"))).toBe("week");
    expect(defaultInterval(rangeOf(365, "2026-11-03"))).toBe("month");
  });

  it("refuses days over more than 366 days, like the ADM-D2 validator", () => {
    expect(intervalAllowed("day", rangeOf(365, "2026-11-03"))).toBe(true);
    expect(
      intervalAllowed("day", { from: "2025-01-01", to: "2026-01-03" }),
    ).toBe(false);
    expect(
      intervalAllowed("week", { from: "2025-01-01", to: "2026-01-03" }),
    ).toBe(true);
  });

  it("labels the buckets short on the axis and long in the tooltip", () => {
    expect(bucketLabel("2026-11-03", "day")).toBe("3/11");
    expect(bucketLabel("2026-11-02", "week", true)).toBe("Tuần từ 2/11/2026");
    expect(bucketLabel("2026-11-01", "month")).toBe("T11/26");
    expect(bucketLabel("2026-11-01", "month", true)).toBe("Tháng 11/2026");
  });
});

describe("F-63 numbers", () => {
  it("rounds the y axis to a readable top", () => {
    expect(niceScale(0)).toEqual({ max: 4, step: 1 });
    expect(niceScale(37)).toEqual({ max: 40, step: 10 });
    expect(niceScale(1234)).toEqual({ max: 1500, step: 500 });
  });

  it("lists a breakdown with every known key, zeros kept, unknown keys after", () => {
    const rows = breakdownRows(
      { TRAVELER: 30, MOD: 10, GUEST_X: 5 },
      roleLabels,
    );
    expect(rows.map((row) => [row.label, row.value])).toEqual([
      ["Thực khách", 30],
      ["Chủ nhà hàng", 0],
      ["Mod", 10],
      ["Quản trị viên", 0],
      ["GUEST_X", 5],
    ]);
    expect(rows[0].share).toBeCloseTo(30 / 45);
  });

  it("words shares and top scores", () => {
    expect(percent(3, 4)).toBe("75%");
    expect(percent(0, 0)).toBe("—");
    expect(topScore("restaurants", 4.66)).toBe("4,7 ★");
    expect(topScore("dishes", 1200)).toBe("1.200 lượt thích");
  });

  it("says when the backend has no dashboard yet", () => {
    expect(dashboardError(new ApiError(404, "HTTP_404", "x"))).toContain(
      "Máy chủ chưa có chức năng thống kê",
    );
    expect(
      dashboardError(new ApiError(400, "VALIDATION_FAILED", "x")),
    ).toContain("366 ngày");
  });
});

describe("F-63 requests and proxy", () => {
  it("lets only the four read operations through", () => {
    for (const path of [
      "admin/dashboard/summary",
      "admin/dashboard/timeseries",
      "admin/dashboard/top",
      "admin/outbox",
    ])
      expect(adminDashboardOperation("GET", path)).toEqual({
        body: false,
        status: 200,
      });
    for (const [method, path] of [
      ["POST", "admin/outbox"],
      ["GET", "admin/dashboard"],
      ["GET", "admin/outbox/7781/retry"],
      ["PUT", "admin/dashboard/summary"],
    ])
      expect(
        adminDashboardOperation(method, path),
        `${method} ${path}`,
      ).toBeNull();
  });

  it("is a typed service over the documented paths", () => {
    expect(Object.keys(dashboardService).sort()).toEqual([
      "outbox",
      "summary",
      "timeseries",
      "top",
    ]);
  });
});
