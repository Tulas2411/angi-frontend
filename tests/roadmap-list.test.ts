import { describe, expect, it } from "vitest";
import {
  isOverBudget,
  parseRoadmapPage,
  roadmapDateRange,
  roadmapItemsLabel,
  roadmapListPageSize,
  roadmapOriginText,
  vnd,
} from "@/features/roadmaps/roadmap-list-rules";
import { roadmapListHref } from "@/features/roadmaps/routes";
import type { RoadmapSummaryDto } from "@/features/roadmaps/roadmap-types";

// RM-02 JSON sample (API Design v1.8, sheet "JSON mẫu", r866–r894).
const sample: RoadmapSummaryDto = {
  id: 88,
  title: "3 ngày ăn sập Đà Nẵng",
  startDate: "2026-10-10",
  endDate: "2026-10-12",
  numDays: 3,
  budgetAmount: 1500000,
  totalEstimatedCost: 640000,
  itemCount: 9,
  coverUrl: "https://cdn.angi.vn/dishes/105.jpg",
  originMode: "pinned",
  originLatitude: 16.061204,
  originLongitude: 108.227531,
  originLabel: "Khách sạn Sala Đà Nẵng",
  createdAt: "2026-10-02T02:00:00Z",
  updatedAt: "2026-10-02T03:00:00Z",
};

describe("RM-02 list presentation", () => {
  it("pages stay within the documented 1–100 pageSize", () => {
    expect(roadmapListPageSize).toBeGreaterThanOrEqual(1);
    expect(roadmapListPageSize).toBeLessThanOrEqual(100);
  });
  it("reads ?page= as a positive integer and falls back to the first page", () => {
    expect(parseRoadmapPage("3")).toBe(3);
    expect(parseRoadmapPage(["2", "5"])).toBe(2);
    for (const value of [
      undefined,
      "",
      "0",
      "-1",
      "abc",
      "1.5",
      "2e3",
      "9999999",
    ])
      expect(parseRoadmapPage(value), String(value)).toBe(1);
    expect(roadmapListHref(1)).toBe("/roadmaps");
    expect(roadmapListHref(4)).toBe("/roadmaps?page=4");
  });
  it("shows the date range, or tells that no start date was chosen", () => {
    expect(roadmapDateRange(sample)).toBe("10 thg 10, 2026 – 12 thg 10, 2026");
    expect(
      roadmapDateRange({ ...sample, endDate: "2026-10-10", numDays: 1 }),
    ).toBe("10 thg 10, 2026");
    expect(
      roadmapDateRange({ ...sample, startDate: null, endDate: null }),
    ).toBe("Chưa chọn ngày đi");
  });
  it("flags a roadmap only when the estimate is above a set budget", () => {
    expect(isOverBudget(sample)).toBe(false);
    expect(isOverBudget({ ...sample, totalEstimatedCost: 1500000 })).toBe(
      false,
    );
    expect(isOverBudget({ ...sample, totalEstimatedCost: 1500001 })).toBe(true);
    expect(
      isOverBudget({ ...sample, budgetAmount: null, totalEstimatedCost: 9e9 }),
    ).toBe(false);
  });
  it("formats money as VND and counts dishes", () => {
    expect(vnd(1500000)).toBe("1.500.000 VND");
    expect(vnd(0)).toBe("0 VND");
    expect(roadmapItemsLabel(9)).toBe("9 món");
    expect(roadmapItemsLabel(0)).toBe("Chưa có món");
  });
  it("names the origin only when one was given", () => {
    expect(roadmapOriginText(sample)).toBe("Khách sạn Sala Đà Nẵng");
    expect(roadmapOriginText({ ...sample, originLabel: "  " })).toBe(
      "Điểm đã chấm trên bản đồ",
    );
    expect(roadmapOriginText({ ...sample, originMode: "gps" })).toBe(
      "Vị trí hiện tại",
    );
    expect(roadmapOriginText({ ...sample, originMode: "none" })).toBeNull();
  });
});
