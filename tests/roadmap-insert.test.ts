import { describe, expect, it } from "vitest";
import {
  addItemError,
  buildAddItemRequest,
} from "@/features/roadmaps/roadmap-add-item-rules";
import {
  planInsert,
  positionOptions,
  resolvePosition,
  restaurantMapsUrl,
} from "@/features/roadmaps/roadmap-insert-rules";
import type {
  MealSlot,
  RoadmapItemDto,
} from "@/features/roadmaps/roadmap-types";
import { ApiError } from "@/shared/api/error";

const item = (
  id: number,
  mealSlot: MealSlot,
  sortOrder: number,
  name = `Món ${id}`,
): RoadmapItemDto =>
  ({
    id,
    dayId: 301,
    dayNumber: 1,
    mealSlot,
    sortOrder,
    dish: { id: id + 100, name },
  }) as unknown as RoadmapItemDto;

// breakfast: 1 · lunch: 2, 3, 4 · dinner: 5
const day = () => [
  item(1, "breakfast", 0),
  item(2, "lunch", 0, "Bún chả"),
  item(3, "lunch", 1, "Nem rán"),
  item(4, "lunch", 2, "Chả cá"),
  item(5, "dinner", 0),
];

describe("where a new dish can go inside a meal", () => {
  it("offers the start, after each dish but the last, and the end", () => {
    expect(positionOptions(day(), "lunch")).toEqual([
      { value: "start", label: "Đầu bữa" },
      { value: "after:2", label: "Sau Bún chả" },
      { value: "after:3", label: "Sau Nem rán" },
      { value: "end", label: "Cuối bữa" },
    ]);
    expect(positionOptions(day(), "breakfast")).toEqual([
      { value: "start", label: "Đầu bữa" },
      { value: "end", label: "Cuối bữa" },
    ]);
    // A meal without dishes has one place only.
    expect(positionOptions(day(), "snack")).toEqual([
      { value: "end", label: "Cuối bữa" },
    ]);
  });
  it("falls back to the end when the dish it followed is gone", () => {
    const options = positionOptions(day(), "lunch");
    expect(resolvePosition("after:3", options)).toBe("after:3");
    expect(resolvePosition("after:99", options)).toBe("end");
    // The last dish has no "after" of its own: that place is the end.
    expect(resolvePosition("after:4", options)).toBe("end");
    expect(resolvePosition("start", positionOptions(day(), "snack"))).toBe(
      "end",
    );
  });
});

describe("making room for a new dish (RM-08 then RM-07 sortOrder)", () => {
  it("needs nothing at the end of a meal: sortOrder is left out", () => {
    expect(planInsert(day(), "lunch", "end")).toEqual({ patches: [] });
    expect(planInsert(day(), "snack", "end")).toEqual({ patches: [] });
    expect(planInsert(day(), "snack", "start")).toEqual({ patches: [] });
    // "after the last dish" is the end as well.
    expect(planInsert(day(), "lunch", "after:4")).toEqual({ patches: [] });
  });
  it("moves the dishes from the chosen place one step later and takes that place", () => {
    expect(planInsert(day(), "lunch", "start")).toEqual({
      sortOrder: 0,
      patches: [
        { itemId: 4, sortOrder: 3 },
        { itemId: 3, sortOrder: 2 },
        { itemId: 2, sortOrder: 1 },
      ],
    });
    expect(planInsert(day(), "lunch", "after:2")).toEqual({
      sortOrder: 1,
      patches: [
        { itemId: 4, sortOrder: 3 },
        { itemId: 3, sortOrder: 2 },
      ],
    });
    expect(planInsert(day(), "lunch", "after:3")).toEqual({
      sortOrder: 2,
      patches: [{ itemId: 4, sortOrder: 3 }],
    });
  });
  it("gives real positions to dishes that tied on sortOrder", () => {
    const tied = [
      item(10, "lunch", 0),
      item(11, "lunch", 0),
      item(12, "lunch", 0),
    ];
    // Shown by id: 10, 11, 12. After the first one: 10 stays, the new dish is 1, then 11 → 2, 12 → 3.
    expect(planInsert(tied, "lunch", "after:10")).toEqual({
      sortOrder: 1,
      patches: [
        { itemId: 12, sortOrder: 3 },
        { itemId: 11, sortOrder: 2 },
      ],
    });
  });
});

describe("RM-07 body, errors and the place link", () => {
  it("sends sortOrder only when a place was chosen", () => {
    expect(buildAddItemRequest({ id: 105 }, "lunch", "req-1")).toEqual({
      dishId: 105,
      mealSlot: "lunch",
      recoRequestId: "req-1",
    });
    expect(buildAddItemRequest({ id: 105 }, "lunch", "req-1", 0)).toEqual({
      dishId: 105,
      mealSlot: "lunch",
      sortOrder: 0,
      recoRequestId: "req-1",
    });
  });
  it("explains a dish removed while the room was being made", () => {
    const failure = addItemError(
      new ApiError(404, "ROADMAP_ITEM_NOT_FOUND", "x"),
    );
    expect(failure.unavailable).toBe(false);
    expect(failure.message).toMatch(/vừa bị xóa/);
  });
  it("links a restaurant to Google Maps by its coordinates", () => {
    expect(restaurantMapsUrl({ latitude: 21.0285, longitude: 105.8542 })).toBe(
      "https://www.google.com/maps/search/?api=1&query=21.0285,105.8542",
    );
    expect(restaurantMapsUrl({ latitude: null, longitude: 105.8 })).toBeNull();
    expect(restaurantMapsUrl({ latitude: 21, longitude: null })).toBeNull();
  });
});
