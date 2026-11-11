import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activeDishFilterCount,
  activeRestaurantFilterCount,
  appendRestaurants,
  businessHoursByDay,
  cloudinaryImage,
  dishApiQuery,
  dishFiltersHref,
  dishPictures,
  dishPriceProblem,
  dishQueryFromParams,
  emptyDishFilters,
  emptyRestaurantFilters,
  googleMapsPlaceHref,
  operatingBadge,
  menuPreview,
  otherMenuDishes,
  parseEntityId,
  priceLevelText,
  priceTag,
  ratingShares,
  satisfiedShare,
  ratingSummary,
  reportError,
  reportProblems,
  restaurantApiQuery,
  restaurantFiltersHref,
  restaurantQueryFromParams,
  reviewError,
  reviewProblems,
  todayOpening,
  vietnamWeekday,
  visibleReply,
} from "@/features/explore/explore-rules";
import {
  exploreService,
  queryString,
} from "@/features/explore/explore-service";
import type {
  RestaurantCardDto,
  ReviewDto,
} from "@/features/explore/explore-types";
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
  it("colours today: red when closed or a day off, amber outside hours, green when open", () => {
    expect(todayOpening("open", true, true)).toEqual({
      tone: "success",
      text: "Đang mở cửa",
    });
    expect(todayOpening("open", false, true)).toEqual({
      tone: "warning",
      text: "Ngoài giờ mở cửa",
    });
    expect(todayOpening("open", false, false)).toEqual({
      tone: "error",
      text: "Hôm nay nghỉ",
    });
    expect(todayOpening("temporarily_closed", true, true).tone).toBe("error");
    expect(todayOpening("permanently_closed", false, true).text).toBe(
      "Đã đóng cửa",
    );
  });
  it("marks today by the Vietnam calendar, not the browser time zone", () => {
    // 2026-11-02 18:00 UTC is already Tuesday 01:00 in Vietnam.
    expect(vietnamWeekday(new Date("2026-11-02T18:00:00Z"))).toBe(2);
    expect(vietnamWeekday(new Date("2026-11-01T03:00:00Z"))).toBe(0);
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
        "q=bún bò&province=Thành phố Hà Nội&form=soup&min=20000&price=50000&tag=3&tag=x&tag=9&tag=3&notag=5",
      ),
    );
    expect(filters).toEqual({
      q: "bún bò",
      province: "Thành phố Hà Nội",
      form: "soup",
      minPrice: "20000",
      maxPrice: "50000",
      tagIds: [3, 9],
      excludeTagIds: [5],
    });
    expect(dishApiQuery(filters, "abc")).toEqual({
      q: "bún bò",
      province: "Thành phố Hà Nội",
      dishForm: "soup",
      minPrice: 20000,
      maxPrice: 50000,
      tagIds: [3, 9],
      excludeTagIds: [5],
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
  it("counts the panel filters and refuses a price range that cannot match", () => {
    expect(activeDishFilterCount(emptyDishFilters)).toBe(0);
    expect(
      activeDishFilterCount({
        ...emptyDishFilters,
        q: "phở",
        province: "Thành phố Huế",
        maxPrice: "50000",
        tagIds: [1, 2],
        excludeTagIds: [5],
      }),
    ).toBe(5);
    expect(dishPriceProblem({ minPrice: "100000", maxPrice: "50000" })).toBe(
      "Giá từ phải thấp hơn giá đến.",
    );
    expect(dishPriceProblem({ minPrice: "50000", maxPrice: "50000" })).not.toBe(
      "",
    );
    expect(dishPriceProblem({ minPrice: "20000", maxPrice: "50000" })).toBe("");
    expect(dishPriceProblem({ minPrice: "", maxPrice: "50000" })).toBe("");
  });
  it("ignores values the API does not know", () => {
    const filters = dishQueryFromParams(
      new URLSearchParams("form=pizza&price=1&min=7&notag=0"),
    );
    expect(filters.form).toBe("");
    expect(filters.maxPrice).toBe("");
    expect(filters.minPrice).toBe("");
    expect(filters.excludeTagIds).toEqual([]);
    const restaurants = restaurantQueryFromParams(
      new URLSearchParams("sort=distance&price=9&rating=2&page=-3"),
    );
    expect(restaurants).toEqual({
      ...emptyRestaurantFilters,
      sort: "rating",
      priceLevel: "",
      minRating: "",
    });
  });
  it("reads and writes the restaurant filters; the list pages itself, so no page is kept", () => {
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
    });
    // REST-01: page from 1, pageSize 1..100.
    expect(restaurantApiQuery(filters)).toEqual({
      q: "bún",
      province: undefined,
      priceLevel: 2,
      minRating: 4,
      openNow: true,
      sort: "newest",
      page: 1,
      pageSize: 12,
    });
    expect(restaurantApiQuery(filters, 3)).toMatchObject({ page: 3 });
    expect(restaurantFiltersHref(filters)).toBe(
      "/restaurants?q=b%C3%BAn&price=2&rating=4&open=1&sort=newest",
    );
    expect(
      restaurantQueryFromParams(
        new URLSearchParams(restaurantFiltersHref(filters).split("?")[1]),
      ),
    ).toEqual(filters);
    expect(
      restaurantFiltersHref(restaurantQueryFromParams(new URLSearchParams(""))),
    ).toBe("/restaurants");
  });
  it("counts the panel filters in use, not the search text or the order", () => {
    expect(activeRestaurantFilterCount(emptyRestaurantFilters)).toBe(0);
    expect(
      activeRestaurantFilterCount({
        ...emptyRestaurantFilters,
        q: "phở",
        sort: "newest",
      }),
    ).toBe(0);
    expect(
      activeRestaurantFilterCount({
        q: "",
        province: "Thành phố Hà Nội",
        priceLevel: "2",
        minRating: "4.5",
        openNow: true,
        sort: "rating",
      }),
    ).toBe(4);
  });
  it("adds the next page without repeating a restaurant already shown", () => {
    const card = (id: number) => ({ id }) as RestaurantCardDto;
    const shown = [card(1), card(2), card(3)];
    expect(
      appendRestaurants(shown, [card(3), card(4), card(5)]).map(
        (restaurant) => restaurant.id,
      ),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(appendRestaurants(shown, [])).toEqual(shown);
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

describe("F-13 dish detail images", () => {
  const original =
    "https://res.cloudinary.com/demo/image/upload/v1793778357/dish/578e.jpg";
  it("adds a Cloudinary transformation after /image/upload/ and keeps the version", () => {
    expect(cloudinaryImage(original, "f_auto,q_auto")).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1793778357/dish/578e.jpg",
    );
  });
  it("leaves other hosts, other delivery types and broken URLs unchanged", () => {
    expect(
      cloudinaryImage("https://example.com/image/upload/a.jpg", "f_auto"),
    ).toBe("https://example.com/image/upload/a.jpg");
    const signed =
      "https://res.cloudinary.com/demo/image/authenticated/s--x--/a.jpg";
    expect(cloudinaryImage(signed, "f_auto")).toBe(signed);
    expect(cloudinaryImage("/local/a.jpg", "f_auto")).toBe("/local/a.jpg");
    expect(cloudinaryImage(original, "")).toBe(original);
  });
  it("lists the cover first and every picture once", () => {
    expect(dishPictures("c", ["a", "c", "b", "a"])).toEqual(["c", "a", "b"]);
    expect(dishPictures(null, ["a"])).toEqual(["a"]);
    expect(dishPictures(null, [])).toEqual([]);
  });
  it("picks the other dishes of the menu, available ones first, up to the limit", () => {
    const menu = [
      { id: 1, isAvailable: true },
      { id: 2, isAvailable: false },
      { id: 3, isAvailable: true },
      { id: 4, isAvailable: true },
    ];
    expect(otherMenuDishes(menu, 3).map((dish) => dish.id)).toEqual([1, 4, 2]);
    expect(otherMenuDishes(menu, 1, 2).map((dish) => dish.id)).toEqual([3, 4]);
    expect(otherMenuDishes([{ id: 5, isAvailable: true }], 5)).toEqual([]);
  });
  it("previews the whole menu on the dish page, the dish being read included", () => {
    const menu = [
      { id: 1, isAvailable: true },
      { id: 2, isAvailable: false },
      { id: 3, isAvailable: true },
    ];
    expect(menuPreview(menu).map((dish) => dish.id)).toEqual([1, 3, 2]);
    expect(menuPreview(menu, 2).map((dish) => dish.id)).toEqual([1, 3]);
  });
  it("writes the dish page price as the mock-up does", () => {
    expect(priceTag(75000)).toBe("75.000đ");
    expect(priceTag(1250000)).toBe("1.250.000đ");
  });
});

describe("share of satisfied diners", () => {
  it("counts 4 and 5 stars over every review, rounded to a whole percent", () => {
    expect(satisfiedShare({ "5": 5 })).toBe(100);
    expect(satisfiedShare({ "5": 2, "4": 1, "3": 1, "1": 2 })).toBe(50);
    expect(satisfiedShare({ "5": 1, "2": 2 })).toBe(33);
  });
  it("says nothing without reviews", () => {
    expect(satisfiedShare({})).toBeNull();
  });
});
