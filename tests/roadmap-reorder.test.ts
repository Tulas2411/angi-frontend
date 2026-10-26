import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activeMeals,
  applyPatches,
  moveAnnouncement,
  moveItemError,
  patchBody,
  planMove,
  sortItems,
  stepTarget,
} from "@/features/roadmaps/roadmap-reorder-rules";
import { roadmapService } from "@/features/roadmaps/roadmap-service";
import type {
  MealSlot,
  RoadmapItemDto,
} from "@/features/roadmaps/roadmap-types";
import { ApiError } from "@/shared/api/error";
import { roadmapOperation } from "@/shared/api/roadmap-proxy";

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
    source: "manual",
    recoRequestId: null,
    myFeedback: null,
    createdAt: "2026-10-02T02:10:00Z",
    dish: { id: id + 100, name },
  }) as unknown as RoadmapItemDto;

// breakfast: 1 · lunch: 2, 3, 4 · dinner: 5
const day = () => [
  item(1, "breakfast", 0, "Bún bò Huế"),
  item(2, "lunch", 0),
  item(3, "lunch", 1),
  item(4, "lunch", 2),
  item(5, "dinner", 0),
];
const ids = (items: readonly RoadmapItemDto[]) =>
  items.map((entry) => entry.id);

describe("RM-08 plan of a move", () => {
  it("moves a dish up inside its meal and renumbers only what changed", () => {
    expect(planMove(day(), 3, { mealSlot: "lunch", index: 0 })).toEqual([
      { itemId: 3, sortOrder: 0 },
      { itemId: 2, sortOrder: 1 },
    ]);
  });
  it("moves a dish to the end of its meal", () => {
    expect(planMove(day(), 2, { mealSlot: "lunch", index: 2 })).toEqual([
      { itemId: 2, sortOrder: 2 },
      { itemId: 3, sortOrder: 0 },
      { itemId: 4, sortOrder: 1 },
    ]);
  });
  it("sends nothing when the dish is already there", () => {
    expect(planMove(day(), 3, { mealSlot: "lunch", index: 1 })).toEqual([]);
    expect(planMove(day(), 1, { mealSlot: "breakfast", index: 0 })).toEqual([]);
    expect(planMove(day(), 99, { mealSlot: "lunch", index: 0 })).toEqual([]);
  });
  it("changes the meal when the dish lands in another one", () => {
    expect(planMove(day(), 4, { mealSlot: "breakfast", index: 1 })).toEqual([
      { itemId: 4, mealSlot: "breakfast", sortOrder: 1 },
    ]);
    expect(planMove(day(), 4, { mealSlot: "dinner", index: 0 })).toEqual([
      { itemId: 4, mealSlot: "dinner", sortOrder: 0 },
      { itemId: 5, sortOrder: 1 },
    ]);
  });
  it("settles ties left by earlier generations with real positions", () => {
    const tied = [
      item(10, "lunch", 0),
      item(11, "lunch", 0),
      item(12, "lunch", 0),
    ];
    // Displayed by id: 10, 11, 12. Moving 12 first gives 12, 10, 11: 12 already has 0.
    expect(planMove(tied, 12, { mealSlot: "lunch", index: 0 })).toEqual([
      { itemId: 10, sortOrder: 1 },
      { itemId: 11, sortOrder: 2 },
    ]);
    expect(
      applyPatches(
        tied,
        planMove(tied, 12, { mealSlot: "lunch", index: 0 }),
      ).map((entry) => entry.id),
    ).toEqual([12, 10, 11]);
  });
  it("clamps a position past the end", () => {
    expect(planMove(day(), 2, { mealSlot: "lunch", index: 99 })).toEqual(
      planMove(day(), 2, { mealSlot: "lunch", index: 2 }),
    );
  });
  it("sends the moved dish first so a failure leaves it where it was put", () => {
    const patches = planMove(day(), 4, { mealSlot: "lunch", index: 0 });
    expect(patches[0].itemId).toBe(4);
  });
});

describe("the day after a move", () => {
  it("shows the saved order the way RM-03 will return it", () => {
    const moved = applyPatches(
      day(),
      planMove(day(), 4, { mealSlot: "lunch", index: 0 }),
    );
    expect(ids(moved)).toEqual([1, 4, 2, 3, 5]);
    const acrossMeals = applyPatches(
      day(),
      planMove(day(), 4, { mealSlot: "breakfast", index: 1 }),
    );
    expect(ids(acrossMeals)).toEqual([1, 4, 2, 3, 5]);
    expect(acrossMeals.find((entry) => entry.id === 4)?.mealSlot).toBe(
      "breakfast",
    );
  });
  it("orders by meal, then sortOrder, then id like the backend", () => {
    expect(
      ids(
        sortItems([
          item(9, "dinner", 0),
          item(8, "lunch", 1),
          item(7, "lunch", 1),
          item(6, "breakfast", 5),
        ]),
      ),
    ).toEqual([6, 7, 8, 9]);
    expect(activeMeals(day())).toEqual(["breakfast", "lunch", "dinner"]);
  });
});

describe("the keyboard step", () => {
  it("moves one place inside the meal", () => {
    expect(stepTarget(day(), 3, -1)).toEqual({ mealSlot: "lunch", index: 0 });
    expect(stepTarget(day(), 3, 1)).toEqual({ mealSlot: "lunch", index: 2 });
  });
  it("crosses into the neighbouring meal at the ends of a meal", () => {
    expect(stepTarget(day(), 2, -1)).toEqual({
      mealSlot: "breakfast",
      index: 1,
    });
    expect(stepTarget(day(), 4, 1)).toEqual({ mealSlot: "dinner", index: 0 });
  });
  it("stops at the first and last dish of the day", () => {
    expect(stepTarget(day(), 1, -1)).toBeNull();
    expect(stepTarget(day(), 5, 1)).toBeNull();
    expect(stepTarget(day(), 99, 1)).toBeNull();
  });
  it("skips a meal that has no dishes", () => {
    const gap = [item(1, "breakfast", 0), item(2, "dinner", 0)];
    expect(stepTarget(gap, 1, 1)).toEqual({ mealSlot: "dinner", index: 0 });
  });
});

describe("RM-08 body, messages and errors", () => {
  it("sends only what changes", () => {
    expect(patchBody({ itemId: 3, sortOrder: 0 })).toEqual({ sortOrder: 0 });
    expect(patchBody({ itemId: 4, mealSlot: "dinner", sortOrder: 2 })).toEqual({
      mealSlot: "dinner",
      sortOrder: 2,
    });
  });
  it("tells a screen reader where the dish went", () => {
    expect(moveAnnouncement(day(), 1, { mealSlot: "lunch", index: 1 })).toBe(
      "Đã chuyển Bún bò Huế tới vị trí 2 của bữa trưa.",
    );
  });
  it("tells a missing item from other failures", () => {
    expect(
      moveItemError(new ApiError(404, "ROADMAP_ITEM_NOT_FOUND", "x")),
    ).toMatch(/không còn trong lộ trình/);
    expect(
      moveItemError(new ApiError(503, "SERVICE_UNAVAILABLE", "x")),
    ).toMatch(/Chưa lưu được thứ tự mới: .*kết nối/);
  });
});

describe("RM-08 proxy rule and service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("allows exactly PATCH roadmaps/{id}/items/{id}", () => {
    expect(roadmapOperation("PATCH", "roadmaps/88/items/1502")).toBe(true);
    expect(roadmapOperation("PUT", "roadmaps/88/items/1502")).toBe(false);
    expect(roadmapOperation("PATCH", "roadmaps/88/items")).toBe(false);
    expect(roadmapOperation("PATCH", "roadmaps/88/items/0")).toBe(false);
    expect(roadmapOperation("PATCH", "roadmaps/88/items/1/feedback")).toBe(
      false,
    );
  });
  it("patches the item path with the body and reads the item back", async () => {
    const saved = item(3, "lunch", 0);
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            message: null,
            errorCode: null,
            data: saved,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      roadmapService.updateItem(88, 3, { sortOrder: 0 }),
    ).resolves.toMatchObject({ id: 3, sortOrder: 0 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/backend/roadmaps/88/items/3");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ sortOrder: 0 });
  });
});
