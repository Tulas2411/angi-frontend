import { expect, test, type Page } from "@playwright/test";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";
import type {
  BusinessHourDto,
  DishCardDto,
  ReviewDto,
  RestaurantCardDto,
  RestaurantDetailDto,
} from "../../src/features/explore/explore-types";

/**
 * Public discovery (dishes and restaurants) against a local stub shaped like the API Design
 * samples: DISH-01/02, REST-01..04, CAT-02 for everybody, REV-01, REP-01 and MEDIA-01 for a
 * Traveler. Nothing here reaches Mapbox or a shared backend.
 */
interface Call {
  method: string;
  path: string;
  query: URLSearchParams;
  authorized: boolean;
  body: unknown;
}
let calls: Call[] = [];
let failList: { status: number; errorCode: string } | null = null;
let failReview: { status: number; errorCode: string } | null = null;
let failReport: { status: number; errorCode: string } | null = null;
let myReview: ReviewDto | null = null;
let reviews: ReviewDto[] = [];
let nextMediaId = 9200;

const tags = [
  { id: 1, tagType: "meal_time", code: "lunch", name: "Bữa trưa" },
  { id: 2, tagType: "category", code: "noodle", name: "Món nước" },
];
const mini = (id: number, name: string) => ({
  id,
  name,
  district: "Quận Hoàn Kiếm",
  provinceName: "Thành phố Hà Nội",
  latitude: 21.0285,
  longitude: 105.8542,
  ratingAvg: 4.6,
});
const dish = (
  id: number,
  name: string,
  price: number,
  dishForm: "soup" | "dry" | "other",
  tagIds: number[],
  restaurantId = 7,
): DishCardDto => ({
  id,
  name,
  price,
  coverUrl: null,
  dishForm,
  isAvailable: id !== 103,
  likeCount: 12,
  dislikeCount: 1,
  tags: tags.filter((tag) => tagIds.includes(tag.id)) as DishCardDto["tags"],
  restaurant: mini(
    restaurantId,
    restaurantId === 7 ? "Bún Bò Bà Diệu" : "Phở Gia Truyền",
  ),
  rank: null,
});
const dishes: DishCardDto[] = [
  dish(101, "Bún bò Huế", 45000, "soup", [1, 2]),
  dish(102, "Bánh mì pate", 20000, "dry", [1]),
  dish(103, "Phở bò tái", 60000, "soup", [2], 8),
  dish(104, "Cà phê trứng", 35000, "other", []),
  dish(105, "Bún chả", 55000, "dry", [1], 8),
];
/** DISH-02 descriptions: one long enough to be cut, one dish without any. */
const descriptions: Record<number, string> = {
  101: "Nước dùng hầm xương 8 tiếng, sả và mắm ruốc",
  102: "Bánh mì giòn rụm, pate gan nhà làm, chả lụa, dưa leo và rau mùi. ".repeat(
    5,
  ),
  103: "Phở bò tái chín, nước dùng trong.",
  105: "Chả nướng than hoa ăn kèm bún và nước mắm chua ngọt.",
};
const restaurantCard = (
  id: number,
  name: string,
  priceLevel: number,
  ratingAvg: number,
  isOpenNow = true,
): RestaurantCardDto => ({
  id,
  name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  coverUrl: null,
  addressLine: `${id} Lê Duẩn`,
  district: "Quận Hoàn Kiếm",
  provinceName: "Thành phố Hà Nội",
  latitude: 21.0285,
  longitude: 105.8542,
  priceLevel,
  ratingAvg,
  ratingCount: 213,
  operatingStatus: "open",
  isOpenNow,
  distanceKm: null,
});
const restaurants: RestaurantCardDto[] = [
  restaurantCard(7, "Bún Bò Bà Diệu", 1, 4.6),
  restaurantCard(8, "Phở Gia Truyền", 2, 4.2, false),
  ...Array.from({ length: 14 }, (_, index) =>
    restaurantCard(20 + index, `Quán thử ${index + 1}`, 2, 3.8),
  ),
];
const hours: BusinessHourDto[] = [
  { dayOfWeek: 1, openTime: "06:00", closeTime: "13:30" },
  { dayOfWeek: 2, openTime: "06:00", closeTime: "13:30" },
];
const review = (
  id: number,
  rating: number,
  content: string,
  images: string[] = [],
  reply = false,
): ReviewDto => ({
  id,
  restaurantId: 7,
  user: { id: 30 + id, displayName: `Thực khách ${id}`, avatarUrl: null },
  rating,
  content,
  images,
  roadmapItemId: null,
  status: "visible",
  createdAt: "2026-10-01T13:00:00Z",
  reply: reply
    ? {
        content: "Cảm ơn bạn đã ghé quán!",
        status: "visible",
        createdAt: "2026-10-02T09:00:00Z",
        updatedAt: "2026-10-02T09:00:00Z",
      }
    : null,
});

function detailOf(id: number): RestaurantDetailDto | null {
  const card = restaurants.find((entry) => entry.id === id);
  if (!card) return null;
  return {
    ...card,
    description: "Quán bún bò gia truyền 30 năm",
    phone: "0236 3812 345",
    email: null,
    website: "https://example.test/bun-bo",
    ward: "Phường Hàng Bài",
    images: [],
    businessHours: hours,
    myReview: id === 7 ? myReview : null,
  } as RestaurantDetailDto;
}

const handler: StubHandler = ({ method, url, body, headers }, send) => {
  const rest = url.replace("/api/v1/", "");
  const [path, query = ""] = rest.split("?");
  const params = new URLSearchParams(query);
  const call: Call = {
    method,
    path,
    query: params,
    authorized: Boolean(headers.authorization),
    body,
  };
  const known =
    /^(dishes|restaurants|tags|media)(\/|$)/.test(path) &&
    !/^auth\//.test(path);
  if (!known) return false;
  calls.push(call);

  if (method === "GET" && path === "tags") {
    send(200, tags);
    return true;
  }
  if (method === "GET" && path === "dishes") {
    if (failList) {
      send(failList.status, null, failList.errorCode);
      return true;
    }
    if (params.get("cursor") === "expired") {
      send(400, null, "INVALID_CURSOR");
      return true;
    }
    const q = (params.get("q") ?? "").toLowerCase();
    const maxPrice = Number(params.get("maxPrice") ?? "0");
    const minPrice = Number(params.get("minPrice") ?? "0");
    const form = params.get("dishForm");
    const wanted = params.getAll("tagIds").map(Number);
    const unwanted = params.getAll("excludeTagIds").map(Number);
    const matches = dishes.filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) &&
        (!maxPrice || entry.price <= maxPrice) &&
        (!minPrice || entry.price >= minPrice) &&
        !entry.tags.some((tag) => unwanted.includes(tag.id)) &&
        (!form || entry.dishForm === form) &&
        (!wanted.length || entry.tags.some((tag) => wanted.includes(tag.id))),
    );
    const limit = Number(params.get("limit") ?? "20");
    const offset = Number((params.get("cursor") ?? "c0").slice(1));
    const items = matches.slice(offset, offset + limit);
    send(200, {
      requestId: null,
      items,
      nextCursor: offset + limit < matches.length ? `c${offset + limit}` : null,
    });
    return true;
  }
  const dishDetail = /^dishes\/(\d+)$/.exec(path);
  if (method === "GET" && dishDetail) {
    const found = dishes.find((entry) => entry.id === Number(dishDetail[1]));
    const card = found && restaurants.find((r) => r.id === found.restaurant.id);
    if (!found || !card) send(404, null, "DISH_NOT_FOUND");
    else
      send(200, {
        ...found,
        restaurant: card,
        description: descriptions[found.id] ?? null,
        images: [],
        status: "active",
      });
    return true;
  }
  if (method === "GET" && path === "restaurants") {
    const q = (params.get("q") ?? "").toLowerCase();
    const level = Number(params.get("priceLevel") ?? "0");
    const minRating = Number(params.get("minRating") ?? "0");
    const openNow = params.get("openNow") === "true";
    const matches = restaurants
      .filter(
        (entry) =>
          entry.name.toLowerCase().includes(q) &&
          (!level || entry.priceLevel === level) &&
          entry.ratingAvg >= minRating &&
          (!openNow || entry.isOpenNow),
      )
      .sort((a, b) =>
        params.get("sort") === "newest"
          ? b.id - a.id
          : b.ratingAvg - a.ratingAvg,
      );
    const page = Number(params.get("page") ?? "1");
    const pageSize = Number(params.get("pageSize") ?? "20");
    send(200, {
      items: matches.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      totalItems: matches.length,
      totalPages: Math.ceil(matches.length / pageSize),
    });
    return true;
  }
  const sub = /^restaurants\/(\d+)(?:\/(menu|reviews|reports))?$/.exec(path);
  if (sub) {
    const id = Number(sub[1]);
    const found = detailOf(id);
    if (!found) {
      send(404, null, "RESTAURANT_NOT_FOUND");
      return true;
    }
    if (method === "GET" && !sub[2]) {
      send(200, found);
      return true;
    }
    if (method === "GET" && sub[2] === "menu") {
      send(200, {
        restaurantId: id,
        dishes: dishes.filter((entry) => entry.restaurant.id === id),
      });
      return true;
    }
    if (method === "GET" && sub[2] === "reviews") {
      const rating = Number(params.get("rating") ?? "0");
      const withImage = params.get("hasImage") === "true";
      const sorted = [...reviews].sort((a, b) =>
        params.get("sort") === "rating_asc" ? a.rating - b.rating : b.id - a.id,
      );
      const items = sorted.filter(
        (entry) =>
          (!rating || entry.rating === rating) &&
          (!withImage || entry.images.length > 0),
      );
      const breakdown: Record<string, number> = {};
      for (const entry of reviews)
        breakdown[String(entry.rating)] =
          (breakdown[String(entry.rating)] ?? 0) + 1;
      send(200, {
        items,
        page: 1,
        pageSize: 10,
        totalItems: items.length,
        totalPages: 1,
        ratingAvg: 4.5,
        ratingCount: reviews.length,
        ratingBreakdown: breakdown,
      });
      return true;
    }
    if (method === "POST" && sub[2] === "reviews") {
      if (failReview) {
        send(failReview.status, null, failReview.errorCode);
        return true;
      }
      if (myReview) {
        send(409, null, "REVIEW_ALREADY_EXISTS");
        return true;
      }
      const sent = body as { rating: number; content?: string };
      myReview = review(640, sent.rating, sent.content ?? "");
      reviews = [myReview, ...reviews];
      send(201, myReview);
      return true;
    }
    if (method === "POST" && sub[2] === "reports") {
      if (failReport) {
        send(failReport.status, null, failReport.errorCode);
        return true;
      }
      send(201, { reportId: 88, status: "pending" });
      return true;
    }
  }
  if (method === "POST" && path === "media") {
    nextMediaId += 1;
    send(201, {
      id: nextMediaId,
      url: "/assets/figma/coffee.png",
      mimeType: "image/png",
      sizeBytes: 68,
      purpose: String(body).includes("report_evidence")
        ? "report_evidence"
        : "review",
      createdAt: "2026-10-26T02:00:00Z",
    });
    return true;
  }
  return false;
};

let stub: AccountStub;
test.beforeAll(async () => {
  stub = await startAccountStub(5164, handler);
});
test.afterAll(async () => {
  await stopAccountStub(stub);
});
test.beforeEach(async ({ page }) => {
  stub.reset();
  calls = [];
  failList = null;
  failReview = null;
  failReport = null;
  myReview = null;
  nextMediaId = 9200;
  reviews = [
    review(
      1,
      5,
      "Nước dùng đậm đà, giá hợp lý",
      ["/assets/figma/coffee.png"],
      true,
    ),
    review(2, 4, "Quán đông vào buổi trưa"),
    review(3, 5, "Rất ngon"),
  ];
  await page.setViewportSize({ width: 1440, height: 1800 });
});

const callsTo = (method: string, path: string) =>
  calls.filter((entry) => entry.method === method && entry.path === path);
const cards = (page: Page) => page.locator(".explore-card");
const cardOf = (page: Page, name: string) =>
  cards(page).filter({
    has: page.getByRole("heading", { name, exact: true, level: 3 }),
  });
const dishItems = (page: Page) => page.locator(".dish-item");
const dishOf = (page: Page, name: string) =>
  dishItems(page).filter({
    has: page.getByRole("heading", { name, exact: true, level: 3 }),
  });
const mainNav = (page: Page) =>
  page.getByRole("navigation", { name: "Điều hướng chính" });
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("dishes", () => {
  test("a guest browses dishes: DISH-01 is read without a token and the nav shows the place", async ({
    page,
  }) => {
    await page.goto("/dishes");
    await expect(
      page.getByRole("heading", { name: "Khám phá món ăn", level: 1 }),
    ).toBeVisible();
    await expect(dishItems(page)).toHaveCount(5);
    await expect(dishOf(page, "Bún bò Huế")).toContainText("45.000");
    await expect(dishOf(page, "Bún bò Huế")).toContainText("Bún Bò Bà Diệu");
    await expect(dishOf(page, "Phở bò tái")).toContainText("Tạm hết món");
    await expect(
      mainNav(page).getByRole("link", { name: "Món ăn" }),
    ).toHaveAttribute("aria-current", "page");
    // A guest sees the login buttons, not an account menu, and no token goes to the backend.
    await expect(page.getByRole("link", { name: "Đăng nhập" })).toBeVisible();
    expect(callsTo("GET", "dishes")).toHaveLength(1);
    expect(callsTo("GET", "dishes")[0].authorized).toBe(false);
    expect(callsTo("GET", "dishes")[0].query.get("limit")).toBe("12");
  });

  test("a signed-in traveler gets the account menu and the token reaches the backend", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    calls = [];
    await page.goto("/dishes");
    await expect(dishItems(page)).toHaveCount(5);
    await expect(
      page.locator("summary[aria-label^='Tài khoản']"),
    ).toBeVisible();
    expect(callsTo("GET", "dishes")[0].authorized).toBe(true);
    await expect(
      mainNav(page).getByRole("link", { name: "Lộ trình", exact: true }),
    ).toBeVisible();
  });

  test("filters live in the URL and reach DISH-01 (query, form, price, tags)", async ({
    page,
  }) => {
    await page.goto("/dishes");
    await expect(dishItems(page)).toHaveCount(5);
    await page.getByRole("searchbox", { name: "Tìm món ăn" }).fill("bún");
    await page.getByRole("button", { name: "Hiện bộ lọc" }).click();
    await page.getByLabel("Loại món").selectOption("dry");
    await page.getByLabel("Giá đến").selectOption("100000");
    await page.getByRole("button", { name: "Bữa trưa" }).click();
    await page.getByRole("button", { name: "Áp dụng bộ lọc" }).click();
    await expect(page).toHaveURL(/q=b%C3%BAn|q=bún/);
    await expect(page).toHaveURL(/form=dry/);
    await expect(page).toHaveURL(/price=100000/);
    await expect(page).toHaveURL(/tag=1/);
    await expect(dishItems(page)).toHaveCount(1);
    await expect(dishOf(page, "Bún chả")).toBeVisible();
    const last = callsTo("GET", "dishes").at(-1)!;
    expect(last.query.get("q")).toBe("bún");
    expect(last.query.get("dishForm")).toBe("dry");
    expect(last.query.get("maxPrice")).toBe("100000");
    expect(last.query.getAll("tagIds")).toEqual(["1"]);
    // Clearing the filters goes back to the whole list.
    await page.getByRole("button", { name: "Đặt lại bộ lọc" }).click();
    await expect(page).toHaveURL(/\/dishes$/);
    await expect(dishItems(page)).toHaveCount(5);
  });

  test("no result is said, and there is no “Xem thêm” when everything fits one page", async ({
    page,
  }) => {
    await page.goto("/dishes?q=khong-co-mon-nay");
    await expect(
      page.getByRole("heading", { name: "Không tìm thấy món phù hợp" }),
    ).toBeVisible();
    await page.goto("/dishes");
    await expect(dishItems(page)).toHaveCount(5);
    await expect(
      page.getByRole("button", { name: "Xem thêm món" }),
    ).toHaveCount(0);
  });

  test("“Xem thêm” appends the next page and an expired cursor is explained", async ({
    page,
  }) => {
    // Twelve dishes per page: add enough dishes for a second page.
    for (let index = 0; index < 9; index += 1)
      dishes.push(dish(200 + index, `Món thêm ${index + 1}`, 30000, "dry", []));
    try {
      await page.goto("/dishes");
      await expect(dishItems(page)).toHaveCount(12);
      await page.getByRole("button", { name: "Xem thêm món" }).click();
      await expect(dishItems(page)).toHaveCount(14);
      expect(callsTo("GET", "dishes").at(-1)!.query.get("cursor")).toBe("c12");
      await expect(
        page.getByRole("button", { name: "Xem thêm món" }),
      ).toHaveCount(0);
    } finally {
      dishes.splice(5);
    }
  });

  test("a failed list can be retried", async ({ page }) => {
    failList = { status: 503, errorCode: "SERVICE_UNAVAILABLE" };
    await page.goto("/dishes");
    await expect(
      page.getByRole("heading", { name: "Chưa tải được danh sách món" }),
    ).toBeVisible();
    failList = null;
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(dishItems(page)).toHaveCount(5);
  });

  test("a dish opens its detail with the restaurant that sells it", async ({
    page,
  }) => {
    await page.goto("/dishes");
    await dishOf(page, "Bún bò Huế").getByRole("link").click();
    await expect(page).toHaveURL(/\/dishes\/101$/);
    await expect(
      page.getByRole("heading", { name: "Bún bò Huế", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Nước dùng hầm xương 8 tiếng")).toBeVisible();
    await expect(page.getByText("45.000")).toBeVisible();
    const sells = page.locator(".explore-restaurant");
    await expect(sells).toContainText("Bún Bò Bà Diệu");
    await expect(
      sells.getByRole("link", { name: "Chỉ đường trên Google Maps" }),
    ).toHaveAttribute(
      "href",
      /google\.com\/maps\/search\/\?api=1&query=21\.0285,105\.8542/,
    );
    await sells.getByRole("link", { name: "Xem quán" }).click();
    await expect(page).toHaveURL(/\/restaurants\/7$/);
  });

  test("an unknown dish says so and a bad id is a 404 page", async ({
    page,
  }) => {
    await page.goto("/dishes/999");
    await expect(
      page.getByRole("heading", { name: "Không tìm thấy món" }),
    ).toBeVisible();
    await page.goto("/dishes/abc");
    await expect(
      page.getByRole("heading", { name: "Trang này chưa có" }),
    ).toBeVisible();
  });
  test("three layouts show the same dishes, the choice is remembered and keeps the search", async ({
    page,
  }) => {
    await page.goto("/dishes?q=b%C3%BAn");
    await expect(dishItems(page)).toHaveCount(2);
    const switcher = page.getByRole("group", { name: "Kiểu hiển thị" });
    // Two-column details are the default.
    await expect(
      switcher.getByRole("button", { name: "Lưới chi tiết" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".dish-detail")).toHaveCount(2);
    await expect(dishOf(page, "Bún bò Huế")).toContainText("Món nước");
    await expect(dishOf(page, "Bún bò Huế")).toContainText("Bữa trưa");
    await expect(dishOf(page, "Bún bò Huế")).toContainText(
      "Nước dùng hầm xương 8 tiếng",
    );
    await expect(
      dishOf(page, "Bún bò Huế").getByLabel("12 lượt thích"),
    ).toBeVisible();

    await switcher.getByRole("button", { name: "Danh sách" }).click();
    await expect(page.locator(".dish-row")).toHaveCount(2);
    await expect(dishOf(page, "Bún chả")).toContainText("Chả nướng than hoa");
    await expect(page).toHaveURL(/q=b%C3%BAn/);

    await switcher.getByRole("button", { name: "Thư viện ảnh" }).click();
    await expect(page.locator(".dish-tile")).toHaveCount(2);
    // Only the photo and the name: no price, tag, description or like count.
    await expect(
      dishOf(page, "Bún bò Huế").getByRole("heading", { level: 3 }),
    ).toBeVisible();
    await expect(
      page.locator(
        ".dish-tile :is(.dish-likes, .dish-kinds, .dish-place, .dish-description, .badge)",
      ),
    ).toHaveCount(0);
    await expect(dishOf(page, "Bún bò Huế")).not.toContainText("45.000");

    await page.reload();
    await expect(page.locator(".dish-tile")).toHaveCount(2);
    await expect(
      switcher.getByRole("button", { name: "Thư viện ảnh" }),
    ).toHaveAttribute("aria-pressed", "true");
    await dishOf(page, "Bún bò Huế").getByRole("link").click();
    await expect(page).toHaveURL(/\/dishes\/101$/);
  });

  test("the filter panel opens and closes without losing what was chosen", async ({
    page,
  }) => {
    await page.goto("/dishes");
    await expect(dishItems(page)).toHaveCount(5);
    const toggle = page.getByRole("button", { name: "Hiện bộ lọc" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByLabel("Giá từ")).toBeHidden();
    await toggle.click();
    const hide = page.getByRole("button", { name: "Ẩn bộ lọc" });
    await expect(hide).toHaveAttribute("aria-expanded", "true");
    await page.getByLabel("Giá từ").selectOption("50000");
    await page
      .getByRole("group", { name: "Không ăn (bỏ món có thẻ)" })
      .getByRole("button", { name: "Món nước" })
      .click();
    await hide.click();
    await expect(page.getByLabel("Giá từ")).toBeHidden();
    await page.getByRole("button", { name: /Hiện bộ lọc/ }).click();
    await expect(page.getByLabel("Giá từ")).toHaveValue("50000");
    await page.getByRole("button", { name: "Áp dụng bộ lọc" }).click();
    await expect(page).toHaveURL(/min=50000/);
    await expect(page).toHaveURL(/notag=2/);
    // Bún chả (55.000, no noodle tag) is the only dish left; the panel stays open.
    await expect(dishItems(page)).toHaveCount(1);
    await expect(dishOf(page, "Bún chả")).toBeVisible();
    await expect(page.getByRole("button", { name: /Ẩn bộ lọc/ })).toBeVisible();
    const last = callsTo("GET", "dishes").at(-1)!;
    expect(last.query.get("minPrice")).toBe("50000");
    expect(last.query.getAll("excludeTagIds")).toEqual(["2"]);
    // Collapsed, the applied filters still apply and are counted on the button.
    await page.getByRole("button", { name: /Ẩn bộ lọc/ }).click();
    await expect(
      page.getByRole("button", { name: /Hiện bộ lọc/ }),
    ).toContainText("2");
    await expect(dishItems(page)).toHaveCount(1);
  });

  test("a price range that cannot match is refused before searching", async ({
    page,
  }) => {
    await page.goto("/dishes");
    await expect(dishItems(page)).toHaveCount(5);
    const before = callsTo("GET", "dishes").length;
    await page.getByRole("button", { name: "Hiện bộ lọc" }).click();
    await page.getByLabel("Giá từ").selectOption("100000");
    await page.getByLabel("Giá đến").selectOption("50000");
    await page.getByRole("button", { name: "Áp dụng bộ lọc" }).click();
    await expect(page.getByText("Giá từ phải thấp hơn giá đến.")).toBeVisible();
    expect(callsTo("GET", "dishes")).toHaveLength(before);
  });

  test("descriptions come from the dish detail, a long one can be read in full", async ({
    page,
  }) => {
    await page.goto("/dishes");
    await expect(dishItems(page)).toHaveCount(5);
    await expect(dishOf(page, "Cà phê trứng")).toContainText(
      "Món này chưa có mô tả.",
    );
    const long = dishOf(page, "Bánh mì pate");
    const more = long.getByRole("button", { name: "Đọc thêm" });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await more.click();
    await expect(long.getByRole("button", { name: "Thu gọn" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(page).toHaveURL(/\/dishes$/);
    // Each dish is read once, also after switching layouts.
    await page
      .getByRole("group", { name: "Kiểu hiển thị" })
      .getByRole("button", { name: "Danh sách" })
      .click();
    await expect(page.locator(".dish-row")).toHaveCount(5);
    const reads = calls.filter(
      (call) => call.method === "GET" && /^dishes\/\d+$/.test(call.path),
    );
    expect(reads).toHaveLength(5);
  });

  for (const [width, label] of [
    [1440, "desktop"],
    [820, "tablet"],
    [390, "mobile"],
  ] as const)
    test(`every layout and the open panel fit the ${label} width (${width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/dishes");
      await expect(dishItems(page)).toHaveCount(5);
      await page.getByRole("button", { name: "Hiện bộ lọc" }).click();
      for (const view of ["Danh sách", "Lưới chi tiết", "Thư viện ảnh"]) {
        await page
          .getByRole("group", { name: "Kiểu hiển thị" })
          .getByRole("button", { name: view })
          .click();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, view).toBeLessThanOrEqual(0);
      }
      // Two detail cards a row only where there is room for them.
      await page
        .getByRole("group", { name: "Kiểu hiển thị" })
        .getByRole("button", { name: "Lưới chi tiết" })
        .click();
      const [a, b] = await page
        .locator(".dish-detail")
        .evaluateAll((items) =>
          items.slice(0, 2).map((item) => item.getBoundingClientRect().top),
        );
      if (width === 1440) expect(Math.abs(a - b)).toBeLessThan(2);
      else expect(b).toBeGreaterThan(a);
    });
});

test.describe("restaurants", () => {
  test("the list is paged in the URL and the filters reach REST-01", async ({
    page,
  }) => {
    await page.goto("/restaurants");
    await expect(cards(page)).toHaveCount(12);
    await expect(cardOf(page, "Phở Gia Truyền")).toContainText(
      "Ngoài giờ mở cửa",
    );
    await expect(cardOf(page, "Bún Bò Bà Diệu")).toContainText("Đang mở cửa");
    await page.getByRole("button", { name: "Trang sau" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(cards(page)).toHaveCount(4);
    await page.getByLabel("Mức giá").selectOption("1");
    await page.getByLabel("Chỉ quán đang mở cửa").check();
    await page.getByRole("button", { name: "Tìm quán" }).click();
    await expect(page).toHaveURL(/price=1/);
    await expect(page).toHaveURL(/open=1/);
    await expect(cards(page)).toHaveCount(1);
    const last = callsTo("GET", "restaurants").at(-1)!;
    expect(last.query.get("priceLevel")).toBe("1");
    expect(last.query.get("openNow")).toBe("true");
    expect(last.query.get("page")).toBe("1");
  });

  test("a page past the end falls back to the last page", async ({ page }) => {
    await page.goto("/restaurants?page=9");
    await expect(page).toHaveURL(/page=2/);
    await expect(cards(page)).toHaveCount(4);
  });

  test("the detail shows the menu, reviews with their breakdown and the information", async ({
    page,
  }) => {
    await page.goto("/restaurants/7");
    await expect(
      page.getByRole("heading", { name: "Bún Bò Bà Diệu", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Quán bún bò gia truyền 30 năm")).toBeVisible();
    // Menu tab (REST-03): the dishes that belong to restaurant 7.
    await expect(cards(page)).toHaveCount(3);
    await expect(cardOf(page, "Bún bò Huế")).toBeVisible();
    // Reviews tab (REST-04).
    await page.getByRole("tab", { name: "Đánh giá" }).click();
    await expect(page.locator(".explore-review")).toHaveCount(3);
    await expect(page.getByText("Phản hồi từ quán")).toBeVisible();
    await expect(page.getByText("Cảm ơn bạn đã ghé quán!")).toBeVisible();
    await page.getByRole("button", { name: "Lọc 4 sao: 1 đánh giá" }).click();
    await expect(page.locator(".explore-review")).toHaveCount(1);
    expect(
      callsTo("GET", "restaurants/7/reviews").at(-1)!.query.get("rating"),
    ).toBe("4");
    await page.getByRole("button", { name: "Lọc 4 sao: 1 đánh giá" }).click();
    await expect(page.locator(".explore-review")).toHaveCount(3);
    await page.getByLabel("Chỉ đánh giá có ảnh").check();
    await expect(page.locator(".explore-review")).toHaveCount(1);
    // Information tab: opening hours from Monday and the contact.
    await page.getByRole("tab", { name: "Thông tin" }).click();
    await expect(page.getByText("06:00–13:30").first()).toBeVisible();
    await expect(page.getByText("Chủ nhật")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "0236 3812 345" }),
    ).toHaveAttribute("href", "tel:02363812345");
  });

  test("an unknown restaurant says so", async ({ page }) => {
    await page.goto("/restaurants/999");
    await expect(
      page.getByRole("heading", { name: "Không tìm thấy quán" }),
    ).toBeVisible();
  });

  test("a guest is asked to sign in and an owner sees no review or report button", async ({
    page,
  }) => {
    await page.goto("/restaurants/7");
    await expect(
      page.getByRole("link", { name: "Đăng nhập để đánh giá" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Báo cáo quán" }),
    ).toHaveCount(0);
    await loginAs(page, "owner");
    await page.goto("/restaurants/7");
    await expect(
      page.getByRole("heading", { name: "Bún Bò Bà Diệu", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Viết đánh giá" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Báo cáo quán" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Đăng nhập để đánh giá" }),
    ).toHaveCount(0);
  });
});

test.describe("review and report (traveler)", () => {
  const dialogOf = (page: Page, name: string) =>
    page.getByRole("dialog", { name });

  test("a review needs stars, uploads its photos (MEDIA-01) and sends REV-01", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    await page.goto("/restaurants/7");
    await page.getByRole("button", { name: "Viết đánh giá" }).click();
    const box = dialogOf(page, "Đánh giá Bún Bò Bà Diệu");
    await expect(box).toBeVisible();
    // Stars are required.
    await box.getByRole("button", { name: "Gửi đánh giá" }).click();
    await expect(box.getByText("Chọn số sao từ 1 đến 5.")).toBeVisible();
    expect(callsTo("POST", "restaurants/7/reviews")).toHaveLength(0);
    await box.getByRole("radio", { name: "5 sao: Rất ngon" }).click();
    await box.getByLabel("Cảm nhận của bạn").fill("Nước dùng đậm đà");
    await box.getByLabel("Ảnh món ăn").setInputFiles({
      name: "bun-bo.png",
      mimeType: "image/png",
      buffer: png,
    });
    await expect(
      box.getByRole("button", { name: "Bỏ ảnh bun-bo.png" }),
    ).toBeVisible();
    expect(callsTo("POST", "media")).toHaveLength(1);
    expect(String(callsTo("POST", "media")[0].body)).toContain("review");
    await box.getByRole("button", { name: "Gửi đánh giá" }).click();
    await expect(box).toBeHidden();
    expect(callsTo("POST", "restaurants/7/reviews")[0].body).toEqual({
      rating: 5,
      content: "Nước dùng đậm đà",
      imageMediaIds: [9201],
    });
    // The page reads the restaurant again: the button is replaced by the badge, the review is listed.
    await expect(
      page.getByText("Đã gửi đánh giá của bạn. Cảm ơn bạn!"),
    ).toBeVisible();
    await expect(page.getByText("Bạn đã đánh giá quán này")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Viết đánh giá" }),
    ).toHaveCount(0);
    await expect(page.locator(".explore-review")).toHaveCount(4);
  });

  test("a failed review keeps the dialog; one that exists already is explained", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    await page.goto("/restaurants/7");
    await page.getByRole("button", { name: "Viết đánh giá" }).click();
    const box = dialogOf(page, "Đánh giá Bún Bò Bà Diệu");
    await box.getByRole("radio", { name: "4 sao: Ngon" }).click();
    failReview = { status: 503, errorCode: "SERVICE_UNAVAILABLE" };
    await box.getByRole("button", { name: "Gửi đánh giá" }).click();
    await expect(box.getByRole("alert")).toContainText(
      "Hiện chưa kết nối được",
    );
    failReview = { status: 409, errorCode: "REVIEW_ALREADY_EXISTS" };
    await box.getByRole("button", { name: "Gửi đánh giá" }).click();
    await expect(box).toBeHidden();
    await expect(
      page.getByText(
        "Bạn đã đánh giá quán này trước đó, nên không đánh giá lại được.",
      ),
    ).toBeVisible();
  });

  test("a report needs a description for “other”, uploads evidence and sends REP-01", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    await page.goto("/restaurants/7");
    await page.getByRole("button", { name: "Báo cáo quán" }).click();
    const box = dialogOf(page, "Báo cáo Bún Bò Bà Diệu");
    await box.getByLabel("Lý do khác").check();
    await box.getByRole("button", { name: "Gửi báo cáo" }).click();
    await expect(box.getByText(/Hãy mô tả lý do/)).toBeVisible();
    expect(callsTo("POST", "restaurants/7/reports")).toHaveLength(0);
    await box.getByLabel("Vệ sinh không đảm bảo").check();
    await box.getByLabel(/^Mô tả chi tiết/).fill("Bát đũa không sạch");
    await box.getByLabel("Ảnh bằng chứng").setInputFiles({
      name: "bang-chung.png",
      mimeType: "image/png",
      buffer: png,
    });
    await expect(
      box.getByRole("button", { name: "Bỏ ảnh bang-chung.png" }),
    ).toBeVisible();
    expect(String(callsTo("POST", "media")[0].body)).toContain(
      "report_evidence",
    );
    await box.getByRole("button", { name: "Gửi báo cáo" }).click();
    await expect(box).toBeHidden();
    expect(callsTo("POST", "restaurants/7/reports")[0].body).toEqual({
      reasonCode: "hygiene",
      description: "Bát đũa không sạch",
      evidenceMediaIds: [9201],
    });
    await expect(
      page.getByText("Đã gửi báo cáo. Đội kiểm duyệt sẽ xem xét sớm."),
    ).toBeVisible();
  });

  test("a report that is still waiting is explained", async ({ page }) => {
    await loginAs(page, "traveler");
    await page.goto("/restaurants/7");
    await page.getByRole("button", { name: "Báo cáo quán" }).click();
    failReport = { status: 409, errorCode: "REPORT_ALREADY_PENDING" };
    const box = dialogOf(page, "Báo cáo Bún Bò Bà Diệu");
    await box.getByRole("button", { name: "Gửi báo cáo" }).click();
    await expect(box).toBeHidden();
    await expect(
      page.getByText("Báo cáo trước đó của bạn về quán này đang chờ xử lý."),
    ).toBeVisible();
  });

  test("a photo that is not an image is refused before any upload", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    await page.goto("/restaurants/7");
    await page.getByRole("button", { name: "Viết đánh giá" }).click();
    const box = dialogOf(page, "Đánh giá Bún Bò Bà Diệu");
    await box.getByLabel("Ảnh món ăn").setInputFiles({
      name: "ghi-chu.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("x"),
    });
    await expect(box.getByRole("alert")).toContainText(
      "Chọn ảnh JPG, PNG hoặc WEBP",
    );
    expect(callsTo("POST", "media")).toHaveLength(0);
  });
});

test("the lists and the detail pages fit from 320px to 1440px", async ({
  page,
}) => {
  for (const path of [
    "/dishes",
    "/restaurants",
    "/dishes/101",
    "/restaurants/7",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1800 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path} ${width}px`,
      ).toBe(true);
    }
  }
});
