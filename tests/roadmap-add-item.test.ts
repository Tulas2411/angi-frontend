import { describe, expect, it } from "vitest";
import {
  addItemError,
  buildAddItemRequest,
  buildSuggestionsQuery,
  mostCommonProvince,
  nextMealSlot,
  provinceFromText,
  suggestionsError,
  suggestionsPageSize,
  suggestionsQueryString,
  validateSuggestionFilters,
  type SuggestionFilters,
} from "@/features/roadmaps/roadmap-add-item-rules";
import {
  recallDestination,
  rememberDestination,
} from "@/features/roadmaps/roadmap-destination";
import { ApiError } from "@/shared/api/error";
import { roadmapOperation } from "@/shared/api/roadmap-proxy";
import type {
  RoadmapDayDto,
  RoadmapItemDto,
} from "@/features/roadmaps/roadmap-types";

const filters: SuggestionFilters = {
  province: " Thành phố Đà Nẵng ",
  q: "  bún bò ",
  maxPrice: "80000",
};

const item = (
  id: number,
  mealSlot: RoadmapItemDto["mealSlot"],
  provinceName: string | null,
): RoadmapItemDto => ({
  id,
  dayId: 301,
  dayNumber: 1,
  mealSlot,
  sortOrder: 0,
  source: "manual",
  recoRequestId: null,
  myFeedback: null,
  createdAt: "2026-10-02T02:10:00Z",
  dish: {
    id: id + 100,
    name: `Món ${id}`,
    price: 45000,
    coverUrl: null,
    dishForm: "soup",
    isAvailable: true,
    likeCount: 1,
    dislikeCount: 0,
    tags: [],
    restaurant: {
      id: 7,
      name: "Quán",
      district: null,
      provinceName,
      latitude: null,
      longitude: null,
      ratingAvg: 4,
    },
    status: "active",
    rank: null,
  },
});
const day = (...items: RoadmapItemDto[]): RoadmapDayDto => ({
  dayId: 301,
  dayNumber: 1,
  date: "2026-10-10",
  note: null,
  dayCost: 0,
  items,
});

describe("RM-06 suggestions query", () => {
  it("requires a province and a sane price", () => {
    expect(validateSuggestionFilters({ ...filters, province: "  " })).toEqual({
      province: "Chọn tỉnh / thành phố bạn muốn tìm món.",
    });
    expect(validateSuggestionFilters(filters)).toEqual({});
    expect(
      validateSuggestionFilters({ ...filters, maxPrice: "1".repeat(15) }),
    ).toHaveProperty("maxPrice");
    expect(validateSuggestionFilters({ ...filters, maxPrice: "" })).toEqual({});
  });
  it("builds the documented parameters and leaves empty filters out", () => {
    // The list is not filtered by meal: the meal only decides where a picked dish goes (RM-07).
    expect(buildSuggestionsQuery(filters, { dayId: 301 })).not.toHaveProperty(
      "mealSlot",
    );
    const query = buildSuggestionsQuery(filters, { dayId: 301 });
    expect(query).toEqual({
      province: "Thành phố Đà Nẵng",
      dayId: 301,
      q: "bún bò",
      maxPrice: 80000,
      limit: suggestionsPageSize,
    });
    expect(suggestionsPageSize).toBeGreaterThanOrEqual(1);
    expect(suggestionsPageSize).toBeLessThanOrEqual(50);
    expect(
      buildSuggestionsQuery(
        { ...filters, q: " ", maxPrice: "" },
        { dayId: 301 },
      ),
    ).toEqual({
      province: "Thành phố Đà Nẵng",
      dayId: 301,
      limit: suggestionsPageSize,
    });
  });
  it("sends the position as a pair and the cursor of a later page", () => {
    const query = buildSuggestionsQuery(filters, {
      dayId: 301,
      gps: { latitude: 16.0678, longitude: 108.2208 },
      cursor: "eyJyIjoiNmYwYyIsIm8iOjIwfQ",
    });
    expect(query).toMatchObject({
      lat: 16.0678,
      lng: 108.2208,
      cursor: "eyJyIjoiNmYwYyIsIm8iOjIwfQ",
    });
    const params = new URLSearchParams(suggestionsQueryString(query));
    expect(params.get("province")).toBe("Thành phố Đà Nẵng");
    expect(params.get("dayId")).toBe("301");
    expect(params.has("mealSlot")).toBe(false);
    expect(params.get("q")).toBe("bún bò");
    expect(params.get("maxPrice")).toBe("80000");
    expect(params.get("lat")).toBe("16.0678");
    expect(params.get("lng")).toBe("108.2208");
    expect(params.get("cursor")).toBe("eyJyIjoiNmYwYyIsIm8iOjIwfQ");
    expect(params.get("limit")).toBe("12");
    // Only the documented names, no empty values and no half position.
    const minimal = new URLSearchParams(
      suggestionsQueryString({ province: "Hà Nội", lat: 1 }),
    );
    expect([...minimal.keys()]).toEqual(["province"]);
  });
});

describe("RM-07 body and defaults", () => {
  it("sends the dish, the meal and the reco request id of the chosen suggestion", () => {
    expect(
      buildAddItemRequest(
        { id: 105 },
        "breakfast",
        "6f0c2b1e-8d7a-4c1e-9b3f-2a5d7e9c1f00",
      ),
    ).toEqual({
      dishId: 105,
      mealSlot: "breakfast",
      recoRequestId: "6f0c2b1e-8d7a-4c1e-9b3f-2a5d7e9c1f00",
    });
  });
  it("suggests the province most of the dishes are in", () => {
    expect(mostCommonProvince([])).toBe("");
    expect(
      mostCommonProvince([
        day(
          item(1, "breakfast", "Thành phố Hà Nội"),
          item(2, "lunch", "Thành phố Đà Nẵng"),
          item(3, "dinner", "Thành phố Đà Nẵng"),
          item(4, "snack", null),
        ),
      ]),
    ).toBe("Thành phố Đà Nẵng");
  });
  it("reads the roadmap's province from its title", () => {
    const catalog = [
      { name: "Thành phố Hà Nội" },
      { name: "Thành phố Hồ Chí Minh" },
      { name: "Thành phố Huế" },
      { name: "Tỉnh Lào Cai" },
      { name: "Thành phố Hải Phòng" },
    ];
    expect(provinceFromText("Đi chơi Hà Nội", catalog)).toBe(
      "Thành phố Hà Nội",
    );
    expect(provinceFromText("ĐI CHƠI HA NOI 3 ngày", catalog)).toBe(
      "Thành phố Hà Nội",
    );
    expect(provinceFromText("Ăn ngon ở Hồ Chí Minh", catalog)).toBe(
      "Thành phố Hồ Chí Minh",
    );
    expect(provinceFromText("Du lịch Thành phố Huế", catalog)).toBe(
      "Thành phố Huế",
    );
    // Whole words only, and nothing is guessed from a title without a destination.
    expect(provinceFromText("Chuyến đi Hanoi", catalog)).toBe("");
    expect(provinceFromText("Cuối tuần của tôi", catalog)).toBe("");
    expect(provinceFromText("", catalog)).toBe("");
    expect(provinceFromText("Đi chơi Hà Nội", [])).toBe("");
  });
  it("suggests the first main meal a day does not have yet", () => {
    expect(nextMealSlot(day())).toBe("breakfast");
    expect(nextMealSlot(day(item(1, "breakfast", null)))).toBe("lunch");
    expect(
      nextMealSlot(day(item(1, "breakfast", null), item(2, "dinner", null))),
    ).toBe("lunch");
    expect(
      nextMealSlot(
        day(
          item(1, "breakfast", null),
          item(2, "lunch", null),
          item(3, "dinner", null),
        ),
      ),
    ).toBe("snack");
  });
  it("remembers the destination only as a convenience", () => {
    // Node has no `window`: both helpers must simply do nothing.
    expect(recallDestination(88)).toBe("");
    expect(() => rememberDestination(88, "Hà Nội")).not.toThrow();
  });
});

describe("errors by errorCode", () => {
  it("tells an expired list from other RM-06 failures", () => {
    expect(
      suggestionsError(new ApiError(400, "INVALID_CURSOR", "x")),
    ).toMatchObject({ expired: true });
    expect(
      suggestionsError(new ApiError(404, "ROADMAP_NOT_FOUND", "x")).message,
    ).toMatch(/Không tìm thấy lộ trình/);
    expect(
      suggestionsError(new ApiError(400, "VALIDATION_FAILED", "x")).message,
    ).toMatch(/Bộ lọc chưa hợp lệ/);
    expect(
      suggestionsError(new ApiError(503, "SERVICE_UNAVAILABLE", "x")),
    ).toEqual({
      expired: false,
      message: "Hiện chưa kết nối được với hệ thống.",
    });
  });
  it("tells an unavailable dish from other RM-07 failures", () => {
    expect(
      addItemError(new ApiError(400, "DISH_NOT_AVAILABLE", "x")),
    ).toMatchObject({ unavailable: true });
    expect(addItemError(new ApiError(404, "DAY_NOT_FOUND", "x"))).toMatchObject(
      { unavailable: false },
    );
    expect(
      addItemError(new ApiError(404, "DAY_NOT_FOUND", "x")).message,
    ).toMatch(/Không tìm thấy ngày/);
    expect(
      addItemError(new ApiError(404, "ROADMAP_NOT_FOUND", "x")).message,
    ).toMatch(/Không tìm thấy lộ trình/);
    expect(
      addItemError(new ApiError(400, "VALIDATION_FAILED", "x")).message,
    ).toMatch(/Thông tin món chưa hợp lệ/);
    expect(addItemError(new Error("boom"))).toEqual({
      unavailable: false,
      message: "Có lỗi xảy ra. Vui lòng thử lại.",
    });
  });
});

describe("roadmap proxy allowlist for F-24", () => {
  it("allows RM-06 and RM-07 with numeric ids and nothing around them", () => {
    expect(roadmapOperation("GET", "roadmaps/88/suggestions")).toBe(true);
    expect(roadmapOperation("POST", "roadmaps/88/days/301/items")).toBe(true);
    for (const [method, path] of [
      ["POST", "roadmaps/88/suggestions"],
      ["GET", "roadmaps/88/days/301/items"],
      ["DELETE", "roadmaps/88/days/301/items"],
      ["PUT", "roadmaps/88/days/301/items"],
      ["POST", "roadmaps/abc/days/301/items"],
      ["POST", "roadmaps/88/days/0/items"],
      ["POST", "roadmaps/88/days/301/items/1"],
      ["GET", "roadmaps/88/suggestions/extra"],
      // RM-10 (POST generate) is allowed since F-26; only a wrong method or a deeper path is not.
      ["GET", "roadmaps/88/generate"],
      ["POST", "roadmaps/88/generate/extra"],
      // RM-08 (PATCH item) is allowed since F-27; neighbours of it still are not.
      ["PATCH", "roadmaps/88/items"],
      ["PATCH", "roadmaps/88/items/1/feedback"],
      ["POST", "roadmaps/88/items/1"],
    ])
      expect(roadmapOperation(method, path), `${method} ${path}`).toBe(false);
  });
});
