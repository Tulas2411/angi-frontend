import { describe, expect, it } from "vitest";
import {
  budgetShare,
  dishNotice,
  formatDistance,
  formatDuration,
  googleMapsDayLink,
  dayDishSummary,
  dayShortLabel,
  dayTitle,
  groupByMeal,
  legEndpoints,
  parseTabParam,
  legsByTarget,
  parseDayParam,
  parseRoadmapId,
  wantsDayRoute,
} from "@/features/roadmaps/roadmap-detail-rules";
import { roadmapDetailHref } from "@/features/roadmaps/routes";
import type {
  RoadmapBudgetDto,
  RoadmapItemDto,
  RoadmapRouteDto,
} from "@/features/roadmaps/roadmap-types";
import { roadmapOperation } from "@/shared/api/roadmap-proxy";

// RM-03 JSON sample (API Design v1.8, sheet "JSON mẫu", RoadmapItem 1502).
const item = (
  id: number,
  latitude: number | null,
  longitude: number | null,
  overrides: Partial<RoadmapItemDto["dish"]> = {},
): RoadmapItemDto => ({
  id,
  dayId: 301,
  dayNumber: 1,
  mealSlot: "breakfast",
  sortOrder: 0,
  source: "manual",
  recoRequestId: null,
  myFeedback: null,
  createdAt: "2026-10-02T02:10:00Z",
  dish: {
    id: 105,
    name: "Bún bò Huế",
    price: 45000,
    coverUrl: null,
    dishForm: "soup",
    isAvailable: true,
    likeCount: 128,
    dislikeCount: 9,
    tags: [],
    restaurant: {
      id: 7,
      name: "Bún Bò Bà Diệu",
      district: "Quận Hải Châu",
      provinceName: "Thành phố Đà Nẵng",
      latitude,
      longitude,
      ratingAvg: 4.6,
    },
    status: "active",
    rank: null,
    ...overrides,
  },
});

const pinned = {
  originMode: "pinned" as const,
  originLatitude: 16.061204,
  originLongitude: 108.227531,
};

describe("ids and day in the URL", () => {
  it("accepts only positive integer roadmap ids", () => {
    expect(parseRoadmapId("88")).toBe(88);
    for (const value of ["0", "-1", "abc", "1.5", "01", "", "9999999999999999"])
      expect(parseRoadmapId(value), value).toBeNull();
  });
  it("reads ?day= as a positive day number, otherwise the first day", () => {
    expect(parseDayParam("3")).toBe(3);
    expect(parseDayParam(["2", "4"])).toBe(2);
    for (const value of [undefined, "", "0", "-2", "x", "1.5", "99999"])
      expect(parseDayParam(value), String(value)).toBe(1);
    expect(roadmapDetailHref(88)).toBe("/roadmaps/88");
    expect(roadmapDetailHref(88, { day: 1 })).toBe("/roadmaps/88");
    expect(roadmapDetailHref(88, { day: 3 })).toBe("/roadmaps/88?day=3");
    expect(roadmapDetailHref(88, { tab: "itinerary" })).toBe("/roadmaps/88");
    expect(roadmapDetailHref(88, { tab: "budget", day: 2 })).toBe(
      "/roadmaps/88?tab=budget&day=2",
    );
  });
  it("reads ?tab= as one of the three RoadmapDetail tabs, itinerary by default", () => {
    expect(parseTabParam("overview")).toBe("overview");
    expect(parseTabParam(["budget", "overview"])).toBe("budget");
    for (const value of [undefined, "", "map", "BUDGET", "itinerary "])
      expect(parseTabParam(value), String(value)).toBe("itinerary");
    expect(parseTabParam("itinerary")).toBe("itinerary");
  });
});

describe("day headings and meal groups", () => {
  it("names a day like the Figma list and falls back to its number", () => {
    expect(dayTitle({ date: "2026-09-25", dayNumber: 1 })).toBe(
      "Thứ Sáu, 25 tháng 9",
    );
    expect(dayTitle({ date: "2026-09-27", dayNumber: 3 })).toBe(
      "Chủ Nhật, 27 tháng 9",
    );
    expect(dayTitle({ date: null, dayNumber: 2 })).toBe("Ngày 2");
    expect(dayShortLabel({ date: "2026-09-25", dayNumber: 1 })).toBe("T6 25/9");
    expect(dayShortLabel({ date: "2026-09-27", dayNumber: 3 })).toBe("CN 27/9");
    expect(dayShortLabel({ date: "2026-10-04", dayNumber: 10 })).toBe(
      "CN 4/10",
    );
    expect(dayShortLabel({ date: null, dayNumber: 2 })).toBe("Ngày 2");
  });
  it("lists the dishes of a day on one line", () => {
    expect(dayDishSummary([])).toBe("Chưa có món");
    expect(
      dayDishSummary([item(1, 1, 1), item(2, 2, 2, { name: "Mì Quảng" })]),
    ).toBe("Bún bò Huế · Mì Quảng");
  });
  it("groups consecutive items of the same meal and keeps their order", () => {
    const lunch = (id: number) => ({
      ...item(id, 1, 1),
      mealSlot: "lunch" as const,
    });
    const groups = groupByMeal([
      item(1, 1, 1),
      lunch(2),
      lunch(3),
      item(4, 1, 1),
    ]);
    expect(groups.map((g) => [g.mealSlot, g.items.map((i) => i.id)])).toEqual([
      ["breakfast", [1]],
      ["lunch", [2, 3]],
      ["breakfast", [4]],
    ]);
    expect(groupByMeal([])).toEqual([]);
  });
});

describe("RM-14 presentation", () => {
  it("formats distance and duration of the documented sample", () => {
    expect(formatDistance(2350)).toBe("2,35 km");
    expect(formatDistance(7900)).toBe("7,9 km");
    expect(formatDistance(850)).toBe("850 m");
    expect(formatDistance(12000)).toBe("12 km");
    expect(formatDuration(540)).toBe("9 phút");
    expect(formatDuration(1620)).toBe("27 phút");
    expect(formatDuration(4500)).toBe("1 giờ 15 phút");
    expect(formatDuration(7200)).toBe("2 giờ");
    expect(formatDuration(20)).toBe("1 phút");
    expect(formatDuration(0)).toBe("0 phút");
  });
  it("labels each leg like the Figma connection, with the origin as the start", () => {
    const items = [
      item(1502, 1, 1),
      item(1503, 2, 2, { name: "Mì Quảng" }),
      item(1504, 3, 3, { name: "Bánh xèo" }),
    ];
    const route: RoadmapRouteDto = {
      dayId: 301,
      profile: "driving",
      origin: { latitude: 1, longitude: 1, label: null, source: "pinned" },
      originSkipped: false,
      legs: [
        {
          fromItemId: null,
          toItemId: 1502,
          distanceMeters: 2350,
          durationSeconds: 540,
        },
        {
          fromItemId: 1502,
          toItemId: 1503,
          distanceMeters: 3100,
          durationSeconds: 660,
        },
      ],
      totalDistanceMeters: 5450,
      totalDurationSeconds: 1200,
      isEstimated: false,
    };
    const byTarget = legsByTarget(route);
    expect(legEndpoints(byTarget.get(1502)!, items, null)).toBe(
      "Điểm xuất phát → Bún bò Huế",
    );
    expect(legEndpoints(byTarget.get(1502)!, items, " Khách sạn Sala ")).toBe(
      "Khách sạn Sala → Bún bò Huế",
    );
    expect(legEndpoints(byTarget.get(1503)!, items, null)).toBe(
      "Bún bò Huế → Mì Quảng",
    );
    expect(byTarget.has(1504)).toBe(false);
  });
  it("asks RM-14 only for days that have legs to show", () => {
    const one = [item(1, 1, 1)];
    const two = [item(1, 1, 1), item(2, 2, 2)];
    expect(wantsDayRoute({ originMode: "none" }, [], false)).toBe(false);
    expect(wantsDayRoute({ originMode: "none" }, one, false)).toBe(false);
    expect(wantsDayRoute({ originMode: "none" }, two, false)).toBe(true);
    expect(wantsDayRoute({ originMode: "pinned" }, one, false)).toBe(true);
    expect(wantsDayRoute({ originMode: "pinned" }, [], false)).toBe(false);
    // A `gps` roadmap has no origin until the traveler allows the position.
    expect(wantsDayRoute({ originMode: "gps" }, one, false)).toBe(false);
    expect(wantsDayRoute({ originMode: "gps" }, one, true)).toBe(true);
  });
});

describe("Google Maps link of a day", () => {
  const items = [
    item(1, 16.067812, 108.220116),
    item(2, 16.07, 108.23),
    item(3, 16.08, 108.24),
  ];
  const params = (url: string) => new URL(url).searchParams;
  it("goes from the pinned origin through the items in order", () => {
    const link = googleMapsDayLink(pinned, items)!;
    const query = params(link.url);
    expect(link.url.startsWith("https://www.google.com/maps/dir/?")).toBe(true);
    expect(query.get("api")).toBe("1");
    expect(query.get("origin")).toBe("16.061204,108.227531");
    expect(query.get("destination")).toBe("16.08,108.24");
    expect(query.get("waypoints")).toBe("16.067812,108.220116|16.07,108.23");
    expect(query.get("travelmode")).toBe("driving");
    expect(link).toMatchObject({ stops: 3, truncated: false });
  });
  it("leaves the origin out for none and gps roadmaps", () => {
    for (const originMode of ["none", "gps"] as const) {
      const query = params(
        googleMapsDayLink(
          { originMode, originLatitude: null, originLongitude: null },
          items.slice(0, 2),
        )!.url,
      );
      expect(query.has("origin"), originMode).toBe(false);
      expect(query.get("destination")).toBe("16.07,108.23");
      expect(query.get("waypoints")).toBe("16.067812,108.220116");
    }
  });
  it("uses one stop as the destination and skips dishes without coordinates", () => {
    const query = params(
      googleMapsDayLink(
        { originMode: "none", originLatitude: null, originLongitude: null },
        [item(1, null, null), item(2, 16.07, 108.23)],
      )!.url,
    );
    expect(query.get("destination")).toBe("16.07,108.23");
    expect(query.has("waypoints")).toBe(false);
    expect(googleMapsDayLink(pinned, [item(1, null, null)])).toBeNull();
    expect(googleMapsDayLink(pinned, [])).toBeNull();
  });
  it("keeps the first 10 stops, the most Google Maps accepts", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      item(index + 1, 16 + index / 100, 108),
    );
    const link = googleMapsDayLink(pinned, many)!;
    expect(link).toMatchObject({ stops: 10, truncated: true });
    expect(params(link.url).get("destination")).toBe("16.09,108");
    expect(params(link.url).get("waypoints")!.split("|")).toHaveLength(9);
  });
});

describe("dish and budget presentation", () => {
  it("says a dish is no longer sold unless it is active", () => {
    expect(dishNotice(item(1, 1, 1).dish)).toBeNull();
    expect(dishNotice(item(1, 1, 1, { status: "removed" }).dish)).toBe(
      "Món đã ngừng bán",
    );
    expect(dishNotice(item(1, 1, 1, { status: "hidden" }).dish)).toBe(
      "Món đã ngừng bán",
    );
    expect(dishNotice(item(1, 1, 1, { isAvailable: false }).dish)).toBe(
      "Tạm hết món",
    );
  });
  it("computes the budget share and the overrun like RoadmapDetail.budget", () => {
    const budget: RoadmapBudgetDto = {
      budgetAmount: 1500000,
      totalEstimatedCost: 640000,
      remaining: 860000,
      isOverBudget: false,
      byDay: [],
      byMealSlot: [],
    };
    expect(budgetShare(budget)).toEqual({
      percent: 43,
      over: false,
      overBy: 0,
    });
    expect(budgetShare({ ...budget, totalEstimatedCost: 2000000 })).toEqual({
      percent: 100,
      over: true,
      overBy: 500000,
    });
    expect(
      budgetShare({ ...budget, budgetAmount: null, remaining: null }),
    ).toEqual({
      percent: 0,
      over: false,
      overBy: 0,
    });
  });
});

describe("roadmap proxy allowlist", () => {
  it("allows RM-03, RM-04 and RM-14 with numeric ids only", () => {
    expect(roadmapOperation("GET", "roadmaps/88")).toBe(true);
    expect(roadmapOperation("PATCH", "roadmaps/88")).toBe(true);
    expect(roadmapOperation("GET", "roadmaps/88/days/301/route")).toBe(true);
  });
  it("rejects other methods, ids and paths", () => {
    for (const [method, path] of [
      ["DELETE", "roadmaps/88"],
      ["POST", "roadmaps/88"],
      ["POST", "roadmaps/88/days/301/route"],
      ["GET", "roadmaps/abc"],
      ["GET", "roadmaps/0"],
      ["GET", "roadmaps/88/"],
      ["GET", "roadmaps/88/generate"],
      ["GET", "roadmaps/88/items/1"],
      ["GET", "roadmaps/88/days/abc/route"],
      ["GET", "roadmaps/88/days/301/route/extra"],
      ["GET", "roadmaps/../me"],
      ["GET", "roadmaps/88/../../me"],
    ])
      expect(roadmapOperation(method, path), `${method} ${path}`).toBe(false);
  });
});
