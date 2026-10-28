import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/api/error";
import type { TagDto } from "@/features/explore/explore-types";
import {
  maxExcludedDishes,
  revealedCards,
  rollError,
  rollRequest,
  tabConditions,
  vegetarianTag,
} from "@/features/roll/roll-rules";

/** F-18 Roll Dish: what each tab of ducbui's screen asks DISH-03 and DISH-01 for. */
const tags: TagDto[] = [
  { id: 1, tagType: "meal_time", code: "snack", name: "Ăn vặt" },
  { id: 5, tagType: "dietary", code: "vegetarian", name: "Món chay" },
  { id: 7, tagType: "category", code: "noodle", name: "Món nước" },
];

describe("roll tabs", () => {
  it("Món Việt is every dish; Dưới 50k is the price", () => {
    expect(tabConditions("viet", tags)).toEqual({
      roll: {},
      strip: { limit: 8 },
    });
    expect(tabConditions("budget", tags)).toEqual({
      roll: { maxPrice: 50000 },
      strip: { limit: 8, maxPrice: 50000 },
    });
  });

  it("Ăn nhẹ is the snack meal time, the strip uses its tag when there is one", () => {
    expect(tabConditions("light", tags)).toEqual({
      roll: { mealTime: "snack" },
      strip: { limit: 8, tagIds: [1] },
    });
    expect(tabConditions("light", [])).toEqual({
      roll: { mealTime: "snack" },
      strip: { limit: 8 },
    });
  });

  it("Ăn chay needs the dietary tag and is unavailable without it", () => {
    expect(vegetarianTag(tags)?.id).toBe(5);
    expect(
      vegetarianTag([{ id: 9, tagType: "dietary", code: "x", name: "Đồ chay" }])
        ?.id,
    ).toBe(9);
    expect(tabConditions("vegetarian", tags)).toEqual({
      roll: { tagIds: [5] },
      strip: { limit: 8, tagIds: [5] },
    });
    expect(tabConditions("vegetarian", [tags[2]])).toBeNull();
  });
});

describe("roll request and reveal", () => {
  it("roll again leaves out the dishes already shown, the last 50 at most", () => {
    expect(rollRequest({ maxPrice: 50000 }, [])).toEqual({ maxPrice: 50000 });
    expect(rollRequest({}, [105, 106])).toEqual({ excludeDishIds: [105, 106] });
    const shown = Array.from({ length: 60 }, (_, index) => index + 1);
    const request = rollRequest({}, shown);
    expect(request.excludeDishIds).toHaveLength(maxExcludedDishes);
    expect(request.excludeDishIds?.[0]).toBe(11);
  });

  it("puts the rolled dish third of five, under the marker", () => {
    const strip = [1, 2, 3, 4, 5].map((id) => ({ id }));
    expect(revealedCards(strip, { id: 9 })).toEqual({
      cards: [{ id: 1 }, { id: 2 }, { id: 9 }, { id: 3 }, { id: 4 }],
      selected: 2,
    });
    // Already on the strip: shown once, still in the middle.
    expect(
      revealedCards(strip, { id: 4 }).cards.map((dish) => dish.id),
    ).toEqual([1, 2, 4, 3, 5]);
    expect(revealedCards([], { id: 9 })).toEqual({
      cards: [{ id: 9 }],
      selected: 0,
    });
  });

  it("NO_CANDIDATE asks to change the tab, other failures keep their message", () => {
    expect(rollError(new ApiError(404, "NO_CANDIDATE", "x")).exhausted).toBe(
      true,
    );
    expect(
      rollError(new ApiError(503, "SERVICE_UNAVAILABLE", "Bận")).exhausted,
    ).toBe(false);
  });
});
