import { describe, expect, it } from "vitest";
import {
  groupRoadmapStops,
  roadmapMapCoordinate,
  roadmapMapPoints,
  roadmapMapStops,
} from "@/features/roadmaps/roadmap-map-rules";
import type {
  RoadmapDayDto,
  RoadmapItemDto,
} from "@/features/roadmaps/roadmap-types";

function item(
  id: number,
  dayNumber: number,
  latitude: number | null,
  longitude: number | null,
): RoadmapItemDto {
  return {
    id,
    dayNumber,
    dayId: 300 + dayNumber,
    mealSlot: "lunch",
    sortOrder: id,
    source: "manual",
    recoRequestId: null,
    myFeedback: null,
    createdAt: "2026-10-02T02:10:00Z",
    dish: {
      id: id + 100,
      name: `Món ${id}`,
      price: 45000,
      coverUrl: null,
      dishForm: "dry",
      isAvailable: true,
      likeCount: 0,
      dislikeCount: 0,
      tags: [],
      status: "active",
      rank: null,
      restaurant: {
        id,
        name: `Quán ${id}`,
        district: null,
        provinceName: "Hà Nội",
        latitude,
        longitude,
        ratingAvg: 4.5,
      },
    },
  };
}

function days(): RoadmapDayDto[] {
  return [
    {
      dayId: 301,
      dayNumber: 1,
      date: "2026-10-10",
      note: null,
      dayCost: 135000,
      items: [
        item(11, 1, 21.03, 105.85),
        item(12, 1, null, 105.8),
        item(13, 1, 21.03, 105.85),
      ],
    },
    {
      dayId: 302,
      dayNumber: 2,
      date: null,
      note: null,
      dayCost: 90000,
      items: [item(21, 2, 21.03, 105.85), item(22, 2, 21.030001, 105.85)],
    },
    { dayId: 303, dayNumber: 3, date: null, note: null, dayCost: 0, items: [] },
  ];
}

describe("roadmap map coordinates", () => {
  it("preserves valid zeros and boundary coordinates while excluding missing/non-finite/out-of-range values", () => {
    expect(roadmapMapCoordinate(0, 0)).toEqual({ latitude: 0, longitude: 0 });
    expect(roadmapMapCoordinate(-90, 180)).toEqual({
      latitude: -90,
      longitude: 180,
    });
    for (const [latitude, longitude] of [
      [null, 105],
      [21, null],
      [NaN, 105],
      [21, Infinity],
      [91, 105],
      [21, -181],
    ] as const) {
      expect(roadmapMapCoordinate(latitude, longitude)).toBeNull();
    }
  });

  it("keeps every actual item and original day order/number even without coordinates", () => {
    const itinerary = days();
    const before = structuredClone(itinerary);
    const stops = roadmapMapStops(itinerary);
    expect(
      stops.map((stop) => [stop.item.id, stop.dayNumber, stop.number]),
    ).toEqual([
      [11, 1, 1],
      [12, 1, 2],
      [13, 1, 3],
      [21, 2, 1],
      [22, 2, 2],
    ]);
    expect(stops[0].dayLabel).toBe("T7 10/10");
    expect(stops[3].dayLabel).toBe("Ngày 2");
    expect(stops[1].coordinate).toBeNull();
    expect(itinerary).toEqual(before);
  });

  it("groups repeated coordinates across meals/days without rounding or moving nearby stops", () => {
    const groups = groupRoadmapStops(roadmapMapStops(days()));
    expect(groups).toHaveLength(2);
    expect(groups[0].stops.map((stop) => stop.item.id)).toEqual([11, 13, 21]);
    expect(groups[0].coordinate).toEqual({
      latitude: 21.03,
      longitude: 105.85,
    });
    expect(groups[1].coordinate).toEqual({
      latitude: 21.030001,
      longitude: 105.85,
    });
    expect(
      groups
        .flatMap((group) => group.stops)
        .some((stop) => stop.item.id === 12),
    ).toBe(false);
  });

  it("fits only active-day coordinates when present, with a valid passed origin", () => {
    expect(
      roadmapMapPoints(roadmapMapStops(days()), 1, {
        latitude: 21.01,
        longitude: 105.81,
        source: "pinned",
      }),
    ).toEqual([
      [105.81, 21.01],
      [105.85, 21.03],
    ]);
  });

  it("does not include a skipped, missing or invalid origin in map bounds", () => {
    const stops = roadmapMapStops(days());
    const start = {
      latitude: 10.7,
      longitude: 106.7,
      source: "pinned" as const,
    };
    expect(roadmapMapPoints(stops, 1, start, true)).toEqual([[105.85, 21.03]]);
    expect(roadmapMapPoints(stops, 1, null)).toEqual([[105.85, 21.03]]);
    expect(roadmapMapPoints(stops, 1, { ...start, latitude: NaN })).toEqual([
      [105.85, 21.03],
    ]);
    expect(roadmapMapPoints(stops, 1)).toEqual([[105.85, 21.03]]);
  });

  it("uses other actual located stops for an empty day and handles entirely missing data", () => {
    expect(roadmapMapPoints(roadmapMapStops(days()), 3)).toEqual([
      [105.85, 21.03],
      [105.85, 21.030001],
    ]);
    expect(roadmapMapStops([])).toEqual([]);
    expect(groupRoadmapStops([])).toEqual([]);
    expect(roadmapMapPoints([], 1)).toEqual([]);
    const itinerary = days();
    itinerary[0].items = [item(99, 1, null, null)];
    expect(roadmapMapPoints(roadmapMapStops(itinerary.slice(0, 1)), 1)).toEqual(
      [],
    );
  });
});
