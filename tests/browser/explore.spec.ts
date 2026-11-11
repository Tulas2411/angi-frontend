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

import { chooseOption, expectOption } from "./select-helpers";
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
/** Dish descriptions, on the cards (DishCard) since 2026-11-09: one long enough to be cut, one dish without any. */
const descriptions: Record<number, string> = {
  101: "Nước dùng hầm xương 8 tiếng, sả và mắm ruốc",
  102: "Bánh mì giòn rụm, pate gan nhà làm, chả lụa, dưa leo và rau mùi. ".repeat(
    10,
  ),
  103: "Phở bò tái chín, nước dùng trong.",
  105: "Chả nướng than hoa ăn kèm bún và nước mắm chua ngọt.",
};
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
  description: descriptions[id] ?? null,
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
  description: "Quán bún bò gia truyền 30 năm",
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
/** Restaurant rows: the list reuses the dish rows (`dish-item`) since #108. */
const cards = (page: Page) => page.locator(".dish-items .dish-item");
/** Heights of the list rows on the page. */
const rowHeights = (page: Page) =>
  page
    .locator(".dish-row")
    .evaluateAll((rows) => rows.map((row) => row.clientHeight));
/** Classes of the parts of an item body cut short by the item's height (the description excepted). */
const squeezedParts = (item: ReturnType<Page["locator"]>) =>
  item.locator(".dish-body").evaluate((body) =>
    [...body.querySelectorAll(":scope > *, :scope > .dish-head > *")]
      .filter((part) => !part.classList.contains("dish-description-wrap"))
      .filter((part) => part.scrollHeight > part.clientHeight + 1)
      .map((part) => part.className),
  );
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
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Đăng nhập" }),
    ).toBeVisible();
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
      page.locator("header").getByRole("link", { name: /^Tài khoản / }),
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
    // Wide screen: the filters are a sidebar, always shown, with no button to open them.
    await expect(
      page.getByRole("button", { name: "Hiện bộ lọc" }),
    ).toBeHidden();
    await chooseOption(page.getByLabel("Loại món"), "dry");
    await chooseOption(page.getByLabel("Giá đến"), "100000");
    await page.getByRole("button", { name: "Bữa trưa" }).click();
    // Each pick applies at once (no "Áp dụng" button), with the typed search text.
    await expect(
      page.getByRole("button", { name: "Áp dụng bộ lọc" }),
    ).toHaveCount(0);
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
    await expect(page.locator(".dish-page-price")).toHaveText("45.000đ");
    // No photo: the plate holds the placeholder and nothing opens a zoom.
    await expect(page.locator(".dish-plate .dish-plate-empty")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Xem ảnh lớn của Bún bò Huế" }),
    ).toHaveCount(0);
    // The facts row: price, form and likes.
    await expect(page.locator(".dish-page-facts")).toContainText(
      "12 lượt thích",
    );
    const sells = page.locator(".dish-page-seller");
    await expect(sells).toContainText("Bún Bò Bà Diệu");
    await expect(
      sells.getByRole("link", { name: "Chỉ đường trên Google Maps" }),
    ).toHaveAttribute(
      "href",
      /google\.com\/maps\/search\/\?api=1&query=21\.0285,105\.8542/,
    );
    // Restaurant 7's menu (REST-03), the dish being viewed included (as in the mock-up).
    const more = page.getByRole("region", {
      name: "Khám phá menu ở Bún Bò Bà Diệu",
    });
    await expect(more.getByRole("link")).toHaveCount(3);
    await expect(more.getByRole("link", { name: /Bún bò Huế/ })).toHaveCount(1);
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
    // Narrow screen: the filters are a panel the search bar's button shows and hides.
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto("/dishes");
    await expect(dishItems(page)).toHaveCount(5);
    const toggle = page.getByRole("button", { name: "Hiện bộ lọc" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByLabel("Giá từ")).toBeHidden();
    await toggle.click();
    const hide = page.getByRole("button", { name: "Ẩn bộ lọc" });
    await expect(hide).toHaveAttribute("aria-expanded", "true");
    await chooseOption(page.getByLabel("Giá từ"), "50000");
    await page
      .getByRole("group", { name: "Không ăn (bỏ món có thẻ)" })
      .getByRole("button", { name: "Món nước" })
      .click();
    // Each pick applies at once; the panel stays open.
    await expect(page).toHaveURL(/min=50000/);
    await expect(page).toHaveURL(/notag=2/);
    // Bún chả (55.000, no noodle tag) is the only dish left.
    await expect(dishItems(page)).toHaveCount(1);
    await expect(dishOf(page, "Bún chả")).toBeVisible();
    await expect(page.getByRole("button", { name: /Ẩn bộ lọc/ })).toBeVisible();
    await hide.click();
    await expect(page.getByLabel("Giá từ")).toBeHidden();
    await page.getByRole("button", { name: /Hiện bộ lọc/ }).click();
    await expectOption(page.getByLabel("Giá từ"), "50000");
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

  test("the filter panel slides down when shown and back up when hidden", async ({
    page,
  }) => {
    /**
     * Presses the toggle and records, on each frame for half a second, the panel's height and the
     * top of the list under the form.
     */
    const slide = (label: string) =>
      page.evaluate(async (text) => {
        const toggle = [...document.querySelectorAll("button")].find((button) =>
          button.textContent?.includes(text),
        )!;
        const box = document.querySelector(".dish-filter-collapse")!;
        const list = document.querySelector(".dish-items")!;
        toggle.click();
        const frames: { height: number; top: number }[] = [];
        const start = performance.now();
        while (performance.now() - start < 500) {
          await new Promise(requestAnimationFrame);
          frames.push({
            height: Math.round(box.getBoundingClientRect().height),
            top: Math.round(list.getBoundingClientRect().top),
          });
        }
        return frames;
      }, label);
    // The dish and the restaurant lists share the panel and its motion.
    // The dish page slides its panel on narrow screens (a sidebar on wide ones).
    await page.setViewportSize({ width: 800, height: 900 });
    for (const path of ["/dishes", "/restaurants"]) {
      await page.goto(path);
      await expect(dishItems(page).first()).toBeVisible();
      const listTopClosed = await page
        .locator(".dish-items")
        .evaluate((list) => Math.round(list.getBoundingClientRect().top));
      const down = (await slide("Hiện bộ lọc")).map((frame) => frame.height);
      const full = down.at(-1)!;
      expect(full).toBeGreaterThan(100);
      // Several frames in between: it grows, it does not appear at once.
      expect(
        down.filter((height) => height > 0 && height < full).length,
      ).toBeGreaterThan(2);
      expect(down).toEqual([...down].sort((a, b) => a - b));
      await expect(page.locator(".dish-filter-panel")).toBeVisible();
      const upFrames = await slide("Ẩn bộ lọc");
      const up = upFrames.map((frame) => frame.height);
      // Closing is short and accelerating, so it does not hang nearly shut before it goes.
      expect(
        await page.locator(".dish-filter-collapse").evaluate((element) => {
          const style = getComputedStyle(element);
          return [style.transitionDuration, style.transitionTimingFunction];
        }),
      ).toEqual([
        "0.16s, 0.16s, 0.16s, 0.16s",
        expect.stringContaining("cubic-bezier(0.55, 0.055, 0.675, 0.19)"),
      ]);
      // The form's gap above the panel folds away with it (a negative margin of the same size),
      // so the list below does not jump when `display: none` removes the panel.
      const [margin, gap] = await page
        .locator(".dish-filter-collapse")
        .evaluate((element) => [
          getComputedStyle(element).marginTop,
          getComputedStyle(element.parentElement!).rowGap,
        ]);
      expect(margin).toBe(`-${gap}`);
      expect(upFrames.at(-1)!.top).toBe(listTopClosed);
      expect(
        up.filter((height) => height > 0 && height < full).length,
      ).toBeGreaterThan(2);
      expect(up).toEqual([...up].sort((a, b) => b - a));
      expect(up.at(-1)).toBe(0);
      await expect(page.locator(".dish-filter-panel")).toBeHidden();
    }
  });

  test("a price range that cannot match is refused before searching", async ({
    page,
  }) => {
    await page.goto("/dishes");
    await expect(dishItems(page)).toHaveCount(5);
    await chooseOption(page.getByLabel("Giá từ"), "100000");
    await expect(page).toHaveURL(/min=100000/);
    const before = callsTo("GET", "dishes").length;
    await chooseOption(page.getByLabel("Giá đến"), "50000");
    await expect(page.getByText("Giá từ phải thấp hơn giá đến.")).toBeVisible();
    await expect(page).not.toHaveURL(/price=50000/);
    expect(callsTo("GET", "dishes")).toHaveLength(before);
  });

  test("descriptions come from the dish cards; a long one scrolls in its box and fades out", async ({
    page,
  }) => {
    await page.goto("/dishes");
    await expect(dishItems(page)).toHaveCount(5);
    // DISH-01 carries them: no DISH-02 per card (12 extra requests a page before 2026-11-09).
    expect(calls.filter((entry) => /^dishes\/\d+$/.test(entry.path))).toEqual(
      [],
    );
    await expect(dishOf(page, "Cà phê trứng")).toContainText(
      "Món này chưa có mô tả.",
    );
    // Every detailed card keeps one height, whatever the length of its text.
    const heights = await page
      .locator(".dish-detail")
      .evaluateAll((items) => items.map((item) => item.clientHeight));
    expect(new Set(heights).size).toBe(1);
    // The whole text is there, without a "…" button; the box scrolls and fades at the bottom.
    const card = dishOf(page, "Bánh mì pate");
    const box = card.locator(".dish-description-wrap");
    await expect(card.locator("p.dish-description")).toHaveText(
      descriptions[102].trim(),
    );
    await expect(
      page.getByRole("button", { name: "Xem toàn bộ mô tả" }),
    ).toHaveCount(0);
    await expect(box).toHaveAttribute("data-faded", "true");
    expect(
      await box.evaluate((element) => ({
        scrolls: element.scrollHeight > element.clientHeight,
        overflow: getComputedStyle(element).overflowY,
        faded: getComputedStyle(element).maskImage.includes("gradient"),
      })),
    ).toEqual({ scrolls: true, overflow: "auto", faded: true });
    // Only the description gives way: the name, the tags and the price keep their full height.
    const squeezed = await card.locator(".dish-body").evaluate((body) =>
      [...body.children]
        .filter((child) => !child.classList.contains("dish-description-wrap"))
        .filter((child) => child.scrollHeight > child.clientHeight + 1)
        .map((child) => child.className),
    );
    expect(squeezed).toEqual([]);
    // Read to the end: the fade goes, and the card did not move or navigate.
    const before = await card.evaluate((element) => element.clientHeight);
    await box.hover();
    await page.mouse.wheel(0, 2000);
    await expect(box).not.toHaveAttribute("data-faded");
    expect(await card.evaluate((element) => element.clientHeight)).toBe(before);
    await expect(page).toHaveURL(/\/dishes$/);
    // A short text fits: no fade, and its box is not raised above the card link.
    const short = dishOf(page, "Bún bò Huế").locator(".dish-description-wrap");
    await expect(short).not.toHaveAttribute("data-overflowing");
    await expect(short).not.toHaveAttribute("data-faded");
    // In the list layout the box is three lines high.
    await page
      .getByRole("group", { name: "Kiểu hiển thị" })
      .getByRole("button", { name: "Danh sách" })
      .click();
    await expect(page.locator(".dish-row")).toHaveCount(5);
    // In a row the box holds at most three lines (less when the row's fixed height leaves less
    // room); the rest scrolls and fades.
    const listBox = await dishOf(page, "Bánh mì pate")
      .locator(".dish-description-wrap")
      .evaluate((element) => ({
        lines:
          element.clientHeight /
          parseFloat(
            getComputedStyle(element.firstElementChild as Element).lineHeight,
          ),
        scrolls: element.scrollHeight > element.clientHeight,
        faded: element.hasAttribute("data-faded"),
      }));
    expect(listBox.lines).toBeGreaterThanOrEqual(1.5);
    expect(listBox.lines).toBeLessThanOrEqual(3.01);
    expect(listBox).toMatchObject({ scrolls: true, faded: true });
    // Every row has the same height, whatever the length of its text.
    expect(new Set(await rowHeights(page)).size).toBe(1);
    expect(await squeezedParts(dishOf(page, "Bánh mì pate"))).toEqual([]);
    // Still no DISH-02 after switching layouts.
    const reads = calls.filter(
      (call) => call.method === "GET" && /^dishes\/\d+$/.test(call.path),
    );
    expect(reads).toHaveLength(0);
  });

  test("a dish card shows the likes at the right of the name, then the type line; a long name fades out", async ({
    page,
  }) => {
    const first = dishes[0];
    const original = first.name;
    first.name =
      "Bún bò Huế giò heo chả cua nước dùng hầm xương tám tiếng sả và mắm ruốc gia truyền ba đời của bà Diệu ở ngõ nhỏ phố cổ Hà Nội từ năm một nghìn chín trăm";
    try {
      await page.goto("/dishes");
      const card = dishItems(page).filter({
        has: page.getByRole("heading", { name: first.name, level: 3 }),
      });
      await expect(card).toHaveCount(1);
      // In a detailed card the likes sit on the name's line, at its right end, above the type line.
      const besideName = async (item: typeof card) => {
        const head = item.locator(".dish-head");
        const [nameBox, likesBox, headBox] = await Promise.all([
          head.locator(".card-name").boundingBox(),
          head.locator(".dish-likes").boundingBox(),
          head.boundingBox(),
        ]);
        expect(likesBox!.x).toBeGreaterThan(nameBox!.x + nameBox!.width - 1);
        expect(likesBox!.y).toBeLessThan(nameBox!.y + nameBox!.height);
        expect(
          Math.abs(likesBox!.x + likesBox!.width - headBox!.x - headBox!.width),
        ).toBeLessThan(1);
      };
      await besideName(card);
      const order = await card
        .locator(".dish-body")
        .evaluate((body) =>
          [...body.children].map((child) =>
            child.classList.contains("dish-head")
              ? "head"
              : child.classList.contains("dish-kinds")
                ? "kinds"
                : "other",
          ),
        );
      expect(order.slice(0, 2)).toEqual(["head", "kinds"]);
      // A long name keeps to one line and fades instead of ending in "…".
      const lineCount = (locator: typeof card) =>
        locator.evaluate(
          (element) =>
            element.clientHeight /
            parseFloat(getComputedStyle(element).lineHeight),
        );
      const masked = (locator: typeof card) =>
        locator.evaluate((element) =>
          getComputedStyle(element).maskImage.includes("gradient"),
        );
      const name = card.locator(".card-name-text");
      await expect(name).toHaveAttribute("data-overflowing", "true");
      expect(Math.round(await lineCount(name))).toBe(1);
      expect(await masked(name)).toBe(true);
      await expect(
        dishOf(page, "Bánh mì pate").locator(".card-name-text"),
      ).not.toHaveAttribute("data-overflowing");
      expect(await squeezedParts(card)).toEqual([]);
      // In the list too the likes sit on the name's line; the photo fills the row's left edge and
      // every row has the same height.
      await page
        .getByRole("group", { name: "Kiểu hiển thị" })
        .getByRole("button", { name: "Danh sách" })
        .click();
      const row = page.locator(".dish-row").filter({
        has: page.getByRole("heading", { name: first.name, level: 3 }),
      });
      await besideName(row);
      await expect(row.locator(".card-name-text")).toHaveAttribute(
        "data-overflowing",
        "true",
      );
      expect(new Set(await rowHeights(page)).size).toBe(1);
      expect(await squeezedParts(row)).toEqual([]);
      const photo = await row.evaluate((item) => {
        const box = item.getBoundingClientRect();
        const thumb = item
          .querySelector(".dish-thumb")!
          .getBoundingClientRect();
        return {
          left: Math.round(thumb.left - box.left - item.clientLeft),
          top: Math.round(thumb.top - box.top - item.clientTop),
          height: Math.round(thumb.height - item.clientHeight),
          width: Math.round(thumb.width),
        };
      });
      expect(photo).toEqual({ left: 0, top: 0, height: 0, width: 200 });
      // On a gallery photo the name may take three lines, then fades the same way.
      await page
        .getByRole("group", { name: "Kiểu hiển thị" })
        .getByRole("button", { name: "Thư viện ảnh" })
        .click();
      const tileName = page
        .locator(".dish-tile")
        .filter({
          has: page.getByRole("heading", { name: first.name, level: 3 }),
        })
        .locator(".card-name-text");
      await expect(tileName).toHaveAttribute("data-overflowing", "true");
      expect(Math.round(await lineCount(tileName))).toBe(3);
      expect(await masked(tileName)).toBe(true);
    } finally {
      first.name = original;
    }
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
      // Below 1024px the filters are a panel to open; wider, the sidebar is always there.
      if (width < 1024)
        await page.getByRole("button", { name: "Hiện bộ lọc" }).click();
      else
        await expect(
          page.getByRole("complementary", { name: "Bộ lọc món ăn" }),
        ).toBeVisible();
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
      // Beside the filter sidebar, as on narrow screens, one detailed card a row.
      expect(b).toBeGreaterThan(a);
    });
});

test.describe("restaurants", () => {
  test("the list loads 12 restaurants, the next ones as its end nears, and the filters reach REST-01", async ({
    page,
  }) => {
    await page.goto("/restaurants");
    await expect(cards(page).first()).toBeVisible();
    expect(callsTo("GET", "restaurants")[0].query.get("page")).toBe("1");
    expect(callsTo("GET", "restaurants")[0].query.get("pageSize")).toBe("12");
    await expect(cardOf(page, "Phở Gia Truyền")).toContainText(
      "Ngoài giờ mở cửa",
    );
    await expect(cardOf(page, "Bún Bò Bà Diệu")).toContainText("Đang mở cửa");
    // No page buttons: the end of the list brings the last 4 of the 16 restaurants.
    await expect(page.getByRole("button", { name: "Trang sau" })).toHaveCount(
      0,
    );
    await page.locator(".explore-lazy").scrollIntoViewIfNeeded();
    await expect(cards(page)).toHaveCount(16);
    expect(
      callsTo("GET", "restaurants").map((call) => call.query.get("page")),
    ).toEqual(["1", "2"]);
    // Wide screen: the filters are a sidebar and each pick applies at once (no "Áp dụng").
    await expect(
      page.getByRole("complementary", { name: "Bộ lọc quán ăn" }),
    ).toBeVisible();
    await chooseOption(page.getByRole("combobox", { name: "Mức giá" }), "1");
    await expect(page).toHaveURL(/price=1/);
    await page.getByLabel("Chỉ quán đang mở cửa").check();
    await expect(page).toHaveURL(/price=1/);
    await expect(page).toHaveURL(/open=1/);
    await expect(cards(page)).toHaveCount(1);
    const last = callsTo("GET", "restaurants").at(-1)!;
    expect(last.query.get("priceLevel")).toBe("1");
    expect(last.query.get("openNow")).toBe("true");
    expect(last.query.get("page")).toBe("1");
  });

  test("an old ?page= link opens the list from its start", async ({ page }) => {
    // Paged links from before the lazy list still work: the page number is ignored.
    await page.goto("/restaurants?page=9");
    await expect(cards(page).first()).toBeVisible();
    expect(callsTo("GET", "restaurants")[0].query.get("page")).toBe("1");
    await expect(cardOf(page, "Bún Bò Bà Diệu")).toBeVisible();
  });

  test("a card hangs its score in its top-right corner beside the name, then the type line; a long name fades out", async ({
    page,
  }) => {
    const first = restaurants[0];
    const unrated = restaurants[1];
    const original = first.name;
    first.name =
      "Nhà hàng Lẩu Tôm Sen Đào Phố Cửa Bắc Ba Đình Hà Nội Gia Truyền Ba Đời Từ Năm Một Nghìn Chín Trăm";
    unrated.ratingCount = 0;
    /** The badge's offset from the card's top-left corner, inside the border. */
    const badgeCorner = (item: ReturnType<Page["locator"]>) =>
      item.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const tag = element.querySelector(".rating-badge")!;
        const badge = tag.getBoundingClientRect();
        // The tag rounds its own corner to the card's inner radius, so nothing shows past it.
        const inner =
          parseFloat(getComputedStyle(element).borderTopRightRadius) -
          element.clientLeft;
        return {
          right: Math.round(box.right - element.clientLeft - badge.right),
          top: Math.round(badge.top - box.top - element.clientTop),
          corner: Math.round(
            parseFloat(getComputedStyle(tag).borderTopRightRadius) - inner,
          ),
        };
      });
    try {
      await page.goto("/restaurants");
      const card = page.locator(".dish-item").filter({
        has: page.getByRole("heading", { name: first.name, level: 3 }),
      });
      await expect(card).toHaveCount(1);
      // The score is a tag hung in the card's top-right corner; it lets clicks through to the card.
      const badge = card.locator(".rating-badge");
      await expect(badge).toHaveText(/4,6\s*\(213\)/);
      await expect(badge).toContainText("4,6 trên 5 sao, 213 đánh giá");
      expect(await badgeCorner(card)).toEqual({ right: 0, top: 0, corner: 0 });
      expect(
        await badge.evaluate(
          (element) => getComputedStyle(element).pointerEvents,
        ),
      ).toBe("none");
      // A restaurant without reviews is marked new.
      await expect(
        page
          .locator(".dish-item")
          .filter({
            has: page.getByRole("heading", { name: unrated.name, level: 3 }),
          })
          .locator(".rating-badge"),
      ).toHaveText(/✦\s*Mới/);
      // The tag shares the name's row, so a long name stops before it; the type line follows.
      const head = card.locator(".dish-head");
      await expect(head.locator(".card-name")).toHaveCount(1);
      await expect(head.locator(".rating-badge")).toHaveCount(1);
      const [nameBox, badgeBox] = await Promise.all([
        head.locator(".card-name").boundingBox(),
        badge.boundingBox(),
      ]);
      expect(nameBox!.x + nameBox!.width).toBeLessThanOrEqual(badgeBox!.x);
      const order = await card
        .locator(".dish-body")
        .evaluate((body) =>
          [...body.children].map((child) =>
            child.classList.contains("dish-head")
              ? "head"
              : child.classList.contains("dish-kinds")
                ? "kinds"
                : "other",
          ),
        );
      expect(order.slice(0, 2)).toEqual(["head", "kinds"]);
      // In a card a long name keeps to one line and fades instead of ending in "…".
      const lineCount = (locator: typeof card) =>
        locator.evaluate(
          (element) =>
            element.clientHeight /
            parseFloat(getComputedStyle(element).lineHeight),
        );
      const masked = (locator: typeof card) =>
        locator.evaluate((element) =>
          getComputedStyle(element).maskImage.includes("gradient"),
        );
      const name = card.locator(".card-name-text");
      await expect(name).toHaveAttribute("data-overflowing", "true");
      expect(Math.round(await lineCount(name))).toBe(1);
      expect(await masked(name)).toBe(true);
      // A short name is shown whole, without the fade.
      await expect(
        page
          .locator(".dish-item")
          .filter({
            has: page.getByRole("heading", { name: "Phở Gia Truyền" }),
          })
          .locator(".card-name-text"),
      ).not.toHaveAttribute("data-overflowing");
      // In the list too the score hangs in the card's top-right corner, and every row has the same height.
      await page
        .getByRole("group", { name: "Kiểu hiển thị" })
        .getByRole("button", { name: "Danh sách" })
        .click();
      const row = page.locator(".dish-row").filter({
        has: page.getByRole("heading", { name: first.name, level: 3 }),
      });
      expect(await badgeCorner(row)).toEqual({ right: 0, top: 0, corner: 0 });
      await expect(row.locator(".card-name-text")).toHaveAttribute(
        "data-overflowing",
        "true",
      );
      expect(new Set(await rowHeights(page)).size).toBe(1);
      expect(await squeezedParts(row)).toEqual([]);
      // Its photo fills the left of the row edge to edge, as in a detailed card.
      const photo = await row.evaluate((item) => {
        const box = item.getBoundingClientRect();
        const thumb = item
          .querySelector(".dish-thumb")!
          .getBoundingClientRect();
        return {
          left: Math.round(thumb.left - box.left - item.clientLeft),
          top: Math.round(thumb.top - box.top - item.clientTop),
          height: Math.round(thumb.height - item.clientHeight),
          width: Math.round(thumb.width),
        };
      });
      expect(photo).toEqual({ left: 0, top: 0, height: 0, width: 200 });
      // On a gallery photo the name may take three lines, then fades the same way.
      await page
        .getByRole("group", { name: "Kiểu hiển thị" })
        .getByRole("button", { name: "Thư viện ảnh" })
        .click();
      const tile = page.locator(".dish-tile").filter({
        has: page.getByRole("heading", { name: first.name, level: 3 }),
      });
      const tileName = tile.locator(".card-name-text");
      await expect(tileName).toHaveAttribute("data-overflowing", "true");
      expect(Math.round(await lineCount(tileName))).toBe(3);
      expect(await masked(tileName)).toBe(true);
      // The gallery shows the score as well, in the tile's top-right corner.
      await expect(tile.locator(".rating-badge")).toHaveText(/4,6/);
      expect(await badgeCorner(tile)).toEqual({ right: 0, top: 0, corner: 0 });
      // On a phone a detailed card stacks; the tag hangs in its top-right corner, on the photo.
      await page.setViewportSize({ width: 390, height: 900 });
      await page
        .getByRole("group", { name: "Kiểu hiển thị" })
        .getByRole("button", { name: "Lưới chi tiết" })
        .click();
      expect(await badgeCorner(card)).toEqual({ right: 0, top: 0, corner: 0 });
    } finally {
      first.name = original;
      unrated.ratingCount = 213;
    }
  });

  test("the menu wheel's dish card flies back to its plate while the backdrop fades, then closes at once", async ({
    page,
  }) => {
    await page.goto("/restaurants/7");
    await page.getByRole("tab", { name: "Thực đơn" }).click();
    const plate = page.getByRole("button", { name: /^Xem chi tiết / });
    await plate.click();
    const dialog = page.locator(".menu-dish-dialog");
    await expect(dialog).toBeVisible();
    // Let the opening morph finish before closing.
    await expect
      .poll(() => dialog.evaluate((element) => element.getAnimations().length))
      .toBe(0);
    const frames = await dialog.evaluate(async (element) => {
      const dialog = element as HTMLDialogElement;
      dialog
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Đóng hộp thoại"]',
        )!
        .click();
      const seen: { open: boolean; backdrop: number }[] = [];
      const start = performance.now();
      while (performance.now() - start < 900) {
        await new Promise(requestAnimationFrame);
        seen.push({
          open: dialog.open,
          backdrop: Number(getComputedStyle(dialog, "::backdrop").opacity),
        });
      }
      return seen;
    });
    const lastOpen = frames.filter((frame) => frame.open).at(-1)!;
    // When the card lands on its plate the backdrop is already gone: nothing is left to fade.
    expect(lastOpen.backdrop).toBeLessThan(0.1);
    expect(frames.at(-1)!.open).toBe(false);
    await expect(dialog).toBeHidden();
    // Opened again, the card has its full backdrop back.
    await plate.click();
    await expect(dialog).toBeVisible();
    await expect
      .poll(() =>
        dialog.evaluate((element) =>
          Number(getComputedStyle(element, "::backdrop").opacity),
        ),
      )
      .toBe(1);
  });

  test("the detail shows the menu, reviews with their breakdown and the information", async ({
    page,
  }) => {
    await page.goto("/restaurants/7");
    await expect(
      page.getByRole("heading", { name: "Bún Bò Bà Diệu", level: 1 }),
    ).toBeVisible();
    // The tabs come first and "Thực đơn" opens by default.
    await expect(page.getByRole("tab", { name: "Thực đơn" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("tab", { name: "Thông tin" }).click();
    await expect(page.getByText("Quán bún bò gia truyền 30 năm")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Liên hệ & vị trí" }),
    ).toBeVisible();
    // Menu tab (REST-03): the dishes that belong to restaurant 7.
    await page.getByRole("tab", { name: "Thực đơn" }).click();
    await expect(
      page.getByRole("heading", { name: "Bún Bò Bà Diệu", level: 1 }),
    ).toBeVisible();
    // Same layouts as the dish list (default "Lưới chi tiết"); the restaurant is not named again.
    const menu = page.getByRole("region", { name: "Thực đơn của quán" });
    await expect(menu.locator(".dish-item")).toHaveCount(3);
    await expect(
      menu.getByRole("heading", { name: "Bún bò Huế", level: 3 }),
    ).toBeVisible();
    await expect(menu.locator(".dish-place-name")).toHaveCount(0);
    await menu.getByRole("button", { name: "Thư viện ảnh" }).click();
    await expect(menu.locator(".dish-tile")).toHaveCount(3);
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
    // The review and report buttons sit with the information (the menu opens first).
    await page.getByRole("tab", { name: "Thông tin" }).click();
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
    await page.getByRole("tab", { name: "Thông tin" }).click();
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
  /** The review and report buttons sit on the information tab (the menu opens first). */
  const openInformation = async (page: Page) => {
    await page.goto("/restaurants/7");
    await page.getByRole("tab", { name: "Thông tin" }).click();
  };
  const dialogOf = (page: Page, name: string) =>
    page.getByRole("dialog", { name });

  test("a review needs stars, uploads its photos (MEDIA-01) and sends REV-01", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    await openInformation(page);
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
    await openInformation(page);
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
    await openInformation(page);
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
    await openInformation(page);
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
    await openInformation(page);
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
