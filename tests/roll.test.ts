import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/api/error";
import {
  emptyRollFilters,
  maxExcludedDishes,
  rollError,
  rollRequest,
} from "@/features/roll/roll-rules";

/** F-18 Roll Dish: the DISH-03 body built from the screen's conditions. */
describe("roll request", () => {
  it("sends an empty body when nothing is chosen", () => {
    expect(rollRequest(emptyRollFilters, [], null)).toEqual({});
  });

  it("sends only the conditions that are set", () => {
    expect(
      rollRequest(
        {
          ...emptyRollFilters,
          mealTime: "lunch",
          province: "  Thành phố Đà Nẵng ",
          maxPrice: "50000",
          tagIds: [3, 5],
        },
        [105],
        null,
      ),
    ).toEqual({
      mealTime: "lunch",
      province: "Thành phố Đà Nẵng",
      maxPrice: 50000,
      tagIds: [3, 5],
      excludeDishIds: [105],
    });
  });

  it("a nearby roll sends the position and radius instead of the province", () => {
    expect(
      rollRequest(
        {
          ...emptyRollFilters,
          province: "Thành phố Hà Nội",
          nearby: true,
          radiusKm: "5",
        },
        [],
        { latitude: 21.0285119, longitude: 105.8541789 },
      ),
    ).toEqual({ latitude: 21.028512, longitude: 105.854179, radiusKm: 5 });
  });

  it("falls back to the province while the position is unknown", () => {
    expect(
      rollRequest(
        { ...emptyRollFilters, province: "Thành phố Huế", nearby: true },
        [],
        null,
      ),
    ).toEqual({ province: "Thành phố Huế" });
  });

  it("leaves out at most the last 50 dishes", () => {
    const shown = Array.from({ length: 60 }, (_, index) => index + 1);
    const request = rollRequest(emptyRollFilters, shown, null);
    expect(request.excludeDishIds).toHaveLength(maxExcludedDishes);
    expect(request.excludeDishIds?.[0]).toBe(11);
  });
});

describe("roll errors", () => {
  it("asks to loosen the conditions when no dish is left", () => {
    const failure = rollError(new ApiError(404, "NO_CANDIDATE", "x"));
    expect(failure.exhausted).toBe(true);
    expect(failure.message).toMatch(/Không còn món/);
  });

  it("keeps any other failure as a plain message", () => {
    expect(
      rollError(new ApiError(503, "SERVICE_UNAVAILABLE", "Bận")).exhausted,
    ).toBe(false);
  });
});
