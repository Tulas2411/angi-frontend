import { afterEach, describe, expect, it, vi } from "vitest";
import {
  businessHoursByDay,
  dishApiQuery,
  dishFiltersHref,
  dishQueryFromParams,
  googleMapsPlaceHref,
  operatingBadge,
  parseEntityId,
  priceLevelText,
  ratingShares,
  ratingSummary,
  reportError,
  reportProblems,
  restaurantApiQuery,
  restaurantFiltersHref,
  restaurantQueryFromParams,
  reviewError,
  reviewProblems,
  visibleReply,
} from "@/features/explore/explore-rules";
import {
  exploreService,
  queryString,
} from "@/features/explore/explore-service";
import type { ReviewDto } from "@/features/explore/explore-types";
import { ApiError } from "@/shared/api/error";
import { publicOperation } from "@/shared/api/public-proxy";

describe("explore display rules", () => {
  it("words ratings, price levels and opening state", () => {
    expect(ratingSummary(4.6, 213)).toBe("4,6 sao · 213 đánh giá");
    expect(ratingSummary(0, 0)).toBe("Chưa có đánh giá");
    expect(priceLevelText(2)).toBe("₫₫");
    expect(priceLevelText(null)).toBeNull();
    expect(priceLevelText(9)).toBeNull();
    expect(operatingBadge("open", true).text).toBe("Đang mở cửa");
    expect(operatingBadge("open", false).text).toBe("Ngoài giờ mở cửa");
    expect(operatingBadge("temporarily_closed", true).tone).toBe("warning");
    expect(operatingBadge("permanently_closed", false).text).toBe(
      "Đã đóng cửa",
    );
  });
  it("lists the opening hours from Monday, several slots in one day", () => {
    const days = businessHoursByDay([
      { dayOfWeek: 0, openTime: "08:00", closeTime: "12:00" },
      { dayOfWeek: 1, openTime: "17:00", closeTime: "22:00" },
      { dayOfWeek: 1, openTime: "06:00", closeTime: "13:30" },
    ]);
    expect(days.map((day) => day.label)).toEqual([
      "Thứ hai",
      "Thứ ba",
      "Thứ tư",
      "Thứ năm",
      "Thứ sáu",
      "Thứ bảy",
      "Chủ nhật",
    ]);
    expect(days[0].text).toBe("06:00–13:30 · 17:00–22:00");
    expect(days[1]).toMatchObject({ text: "Đóng cửa", open: false });
    expect(days[6].text).toBe("08:00–12:00");
  });
  it("shares the five bars by count", () => {
    const shares = ratingShares({ "5": 3, "4": 1 });
    expect(shares.map((row) => row.star)).toEqual([5, 4, 3, 2, 1]);
    expect(shares[0]).toMatchObject({ count: 3, share: 0.75 });
    expect(shares[4]).toMatchObject({ count: 0, share: 0 });
    expect(ratingShares({})[0].share).toBe(0);
  });
  it("links a place on Google Maps only when it has coordinates", () => {
    expect(googleMapsPlaceHref(21.0285, 105.8542)).toBe(
      "https://www.google.com/maps/search/?api=1&query=21.0285,105.8542",
    );
    expect(googleMapsPlaceHref(null, 105)).toBeNull();
  });
  it("accepts only positive whole numbers as ids", () => {
    expect(parseEntityId("105")).toBe(105);
    for (const bad of ["0", "-1", "1.5", "abc", "", "12345678901", "01"])
      expect(parseEntityId(bad), bad).toBeNull();
  });
  it("shows an owner reply only while it is visible", () => {
    const review = (status: "visible" | "hidden") =>
      ({
        reply: {
          content: "Cảm ơn bạn!",
          status,
          createdAt: "",
          updatedAt: "",
        },
      }) as unknown as ReviewDto;
    expect(visibleReply(review("visible"))?.content).toBe("Cảm ơn bạn!");
    expect(visibleReply(review("hidden"))).toBeNull();
    expect(visibleReply({ reply: null } as unknown as ReviewDto)).toBeNull();
  });
});

describe("explore filters in the URL", () => {
  it("reads and writes the dish filters", () => {
    const filters = dishQueryFromParams(
      new URLSearchParams(
        "q=bún bò&province=Thành phố Hà Nội&form=soup&price=50000&tag=3&tag=x&tag=9",
      ),
    );
    expect(filters).toEqual({
      q: "bún bò",
      province: "Thành phố Hà Nội",
      form: "soup",
      maxPrice: "50000",
      tagIds: [3, 9],
    });
    expect(dishApiQuery(filters, "abc")).toEqual({
      q: "bún bò",
      province: "Thành phố Hà Nội",
      dishForm: "soup",
      maxPrice: 50000,
      tagIds: [3, 9],
      cursor: "abc",
      limit: 12,
    });
    const href = dishFiltersHref(filters);
    expect(
      dishQueryFromParams(new URLSearchParams(href.split("?")[1])),
    ).toEqual(filters);
    expect(dishFiltersHref(dishQueryFromParams(new URLSearchParams("")))).toBe(
      "/dishes",
    );
  });
  it("ignores values the API does not know", () => {
    const filters = dishQueryFromParams(
      new URLSearchParams("form=pizza&price=1"),
    );
    expect(filters.form).toBe("");
    expect(filters.maxPrice).toBe("");
    const restaurants = restaurantQueryFromParams(
      new URLSearchParams("sort=distance&price=9&rating=2&page=-3"),
    );
    expect(restaurants).toMatchObject({
      sort: "rating",
      priceLevel: "",
      minRating: "",
      page: 1,
    });
  });
  it("reads and writes the restaurant filters and page", () => {
    const filters = restaurantQueryFromParams(
      new URLSearchParams("q=bún&price=2&rating=4&open=1&sort=newest&page=3"),
    );
    expect(filters).toEqual({
      q: "bún",
      province: "",
      priceLevel: "2",
      minRating: "4",
      openNow: true,
      sort: "newest",
      page: 3,
    });
    expect(restaurantApiQuery(filters)).toEqual({
      q: "bún",
      province: undefined,
      priceLevel: 2,
      minRating: 4,
      openNow: true,
      sort: "newest",
      page: 3,
      pageSize: 12,
    });
    expect(
      restaurantQueryFromParams(
        new URLSearchParams(restaurantFiltersHref(filters).split("?")[1]),
      ),
    ).toEqual(filters);
    expect(
      restaurantFiltersHref(restaurantQueryFromParams(new URLSearchParams(""))),
    ).toBe("/restaurants");
  });
});

describe("REV-01 and REP-01 rules", () => {
  it("needs 1..5 stars and a text within the limit", () => {
    expect(reviewProblems(0, "")).toEqual({
      rating: "Chọn số sao từ 1 đến 5.",
    });
    expect(reviewProblems(6, "").rating).toBeDefined();
    expect(reviewProblems(5, "ngon")).toEqual({});
    expect(reviewProblems(5, "a".repeat(2001)).content).toMatch(/2000/);
  });
  it("needs a description only for the reason “other”", () => {
    expect(reportProblems("hygiene", "")).toEqual({});
    expect(reportProblems("other", "  ").description).toMatch(/mô tả/);
    expect(reportProblems("other", "Quán đổi tên")).toEqual({});
    expect(reportProblems("scam", "a".repeat(1001)).description).toMatch(
      /1000/,
    );
  });
  it("settles a review or report that already exists", () => {
    const review = reviewError(new ApiError(409, "REVIEW_ALREADY_EXISTS", "x"));
    expect(review.settled).toBe(true);
    expect(review.message).toMatch(/đã đánh giá quán này/);
    const report = reportError(
      new ApiError(409, "REPORT_ALREADY_PENDING", "x"),
    );
    expect(report.settled).toBe(true);
    expect(report.message).toMatch(/đang chờ xử lý/);
  });
  it("leaves other failures to be tried again", () => {
    for (const error of [
      new ApiError(503, "SERVICE_UNAVAILABLE", "x"),
      new ApiError(400, "VALIDATION_FAILED", "x"),
      new Error("boom"),
    ]) {
      expect(reviewError(error).settled).toBe(false);
      expect(reportError(error).settled).toBe(false);
    }
    expect(
      reviewError(new ApiError(404, "RESTAURANT_NOT_FOUND", "x")).message,
    ).toMatch(/không còn hiển thị/);
  });
});

describe("explore proxy rules and service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("lets guests read and only a Traveler write", () => {
    for (const [method, path] of [
      ["GET", "dishes"],
      ["GET", "dishes/105"],
      ["GET", "restaurants"],
      ["GET", "restaurants/7"],
      ["GET", "restaurants/7/menu"],
      ["GET", "restaurants/7/reviews"],
      ["GET", "tags"],
    ])
      expect(publicOperation(method, path), `${method} ${path}`).toMatchObject({
        allowGuest: true,
        status: 200,
      });
    expect(publicOperation("POST", "restaurants/7/reviews")).toEqual({
      body: true,
      status: 201,
      allowGuest: false,
    });
    expect(publicOperation("POST", "restaurants/7/reports")).toEqual({
      body: true,
      status: 201,
      allowGuest: false,
    });
    for (const [method, path] of [
      ["PUT", "restaurants/7/reviews"],
      ["DELETE", "restaurants/7/reviews"],
      ["PATCH", "restaurants/7"],
      ["POST", "restaurants/0/reviews"],
      ["POST", "restaurants/abc/reports"],
      ["POST", "restaurants/7/reviews/9"],
      ["GET", "restaurants/7/reports"],
    ])
      expect(publicOperation(method, path), `${method} ${path}`).toBeNull();
  });
  it("builds a query string from the defined values, arrays repeat the key", () => {
    expect(queryString({})).toBe("");
    expect(
      queryString({ q: "bún", tagIds: [1, 2], maxPrice: 0, empty: "" }),
    ).toBe("?q=b%C3%BAn&tagIds=1&tagIds=2&maxPrice=0");
  });
  it("reads dishes through the same-origin proxy and posts a review", async () => {
    const created = { id: 640, rating: 5 };
    const fetchMock = vi.fn(
      async (_url: string, init?: RequestInit) =>
        new Response(
          JSON.stringify({
            success: true,
            message: null,
            errorCode: null,
            data: init?.method === "POST" ? created : { items: [] },
          }),
          {
            status: init?.method === "POST" ? 201 : 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
    );
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);
    await exploreService.browseDishes({ q: "bún", tagIds: [3], limit: 12 });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/backend/dishes?q=b%C3%BAn&tagIds=3&limit=12",
    );
    await expect(
      exploreService.createReview(7, { rating: 5, content: "ngon" }),
    ).resolves.toEqual(created);
    const [url, init] = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/backend/restaurants/7/reviews");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      rating: 5,
      content: "ngon",
    });
  });
});
