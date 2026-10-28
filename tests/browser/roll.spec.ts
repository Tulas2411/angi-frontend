import { expect, test, type Page } from "@playwright/test";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";
import type { DishDetailDto } from "../../src/features/explore/explore-types";

/**
 * F-18 Roll Dish against a local stub shaped like DISH-03 and CAT-02 (API Design v1.8). The stub
 * plays the backend's rules: excluded dishes are never rolled, and 404 NO_CANDIDATE when none is left.
 * The position comes from Playwright's fake geolocation; no map or provider is used.
 */
let rolls: Record<string, unknown>[] = [];
let failRoll = false;

const tags = [
  { id: 1, tagType: "meal_time", code: "lunch", name: "Bữa trưa" },
  { id: 3, tagType: "category", code: "noodle", name: "Món nước" },
  { id: 5, tagType: "dietary", code: "vegetarian", name: "Món chay" },
];

function dish(id: number, name: string, price: number): DishDetailDto {
  return {
    id,
    name,
    price,
    coverUrl: null,
    dishForm: "soup",
    isAvailable: true,
    likeCount: 128,
    dislikeCount: 9,
    tags: [{ id: 3, tagType: "category", code: "noodle", name: "Món nước" }],
    rank: 1,
    description: "Nước dùng ninh xương bò, sả và mắm ruốc.",
    images: [],
    status: "active",
    restaurant: {
      id: 7,
      name: "Bún Bò Bà Diệu",
      slug: "bun-bo-ba-dieu",
      coverUrl: null,
      addressLine: "12 Lê Duẩn",
      district: null,
      provinceName: "Thành phố Đà Nẵng",
      latitude: 16.067812,
      longitude: 108.220116,
      priceLevel: 2,
      ratingAvg: 4.6,
      ratingCount: 210,
      operatingStatus: "open",
      isOpenNow: true,
      distanceKm: null,
    },
  };
}
const menu = [dish(105, "Bún bò Huế", 45000), dish(106, "Mì Quảng", 40000)];

const handler: StubHandler = (request, send) => {
  if (request.url === "/api/v1/tags") {
    send(200, tags);
    return true;
  }
  if (request.url === "/api/v1/dishes/roll" && request.method === "POST") {
    const body = (request.body ?? {}) as Record<string, unknown>;
    rolls.push(body);
    if (failRoll) {
      send(503, null, "SERVICE_UNAVAILABLE");
      return true;
    }
    const excluded = (body.excludeDishIds as number[] | undefined) ?? [];
    const next = menu.find((item) => !excluded.includes(item.id));
    if (!next) send(404, null, "NO_CANDIDATE");
    else
      send(200, {
        rollId: 900 + rolls.length,
        requestId: "6f1c2a8e-1b2c-4d5e-8f90-1234567890ab",
        dish:
          body.latitude === undefined
            ? next
            : { ...next, restaurant: { ...next.restaurant, distanceKm: 1.2 } },
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
test.beforeEach(async ({ context }) => {
  stub.reset();
  rolls = [];
  failRoll = false;
  // Province suggestions come from a public provider; the field also accepts typed names.
  await context.route("**/api/locations/**", (route) =>
    route.fulfill({ json: { success: true, data: [] } }),
  );
});

const result = (page: Page) => page.locator(".roll-result");
const rollButton = (page: Page) =>
  page.getByRole("button", { name: "Roll món", exact: true });

test("only a traveler rolls; the account menu leads there", async ({
  page,
}) => {
  await page.goto("/roll");
  await expect(page).toHaveURL(/\/login/);
  await loginAs(page, "owner");
  await page.goto("/roll");
  await expect(page).toHaveURL(/\/restaurant/);
  await loginAs(page, "traveler");
  await page.locator("summary[aria-label^='Tài khoản']").click();
  await page.getByRole("link", { name: "Hôm nay ăn gì?" }).click();
  await expect(page).toHaveURL(/\/roll$/);
  await expect(
    page.getByRole("heading", { name: "Hôm nay ăn gì?", level: 1 }),
  ).toBeVisible();
});

test("the chosen conditions are sent, the dish is shown and roll again leaves it out", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  await page.goto("/roll");
  await page.getByLabel("Bữa").selectOption("lunch");
  await page.getByLabel("Mức giá").selectOption("50000");
  await page.getByLabel("Tỉnh / thành phố").fill("Thành phố Đà Nẵng");
  // Meal times have their own select, so only the other tags are chips.
  await expect(page.getByRole("button", { name: "Bữa trưa" })).toHaveCount(0);
  await page.getByRole("button", { name: "Món nước" }).click();
  await rollButton(page).click();

  await expect(
    result(page).getByRole("heading", { name: "Bún bò Huế" }),
  ).toBeVisible();
  await expect(result(page)).toContainText("45.000");
  await expect(result(page)).toContainText(
    "Bún Bò Bà Diệu · Thành phố Đà Nẵng",
  );
  await expect(result(page)).toContainText("4,6 sao");
  expect(rolls).toEqual([
    {
      mealTime: "lunch",
      maxPrice: 50000,
      tagIds: [3],
      province: "Thành phố Đà Nẵng",
    },
  ]);
  await expect(
    result(page).getByRole("link", { name: /Xem món/ }),
  ).toHaveAttribute("href", "/dishes/105");

  await page.getByRole("button", { name: "Roll món khác" }).click();
  await expect(
    result(page).getByRole("heading", { name: "Mì Quảng" }),
  ).toBeVisible();
  expect(rolls[1]).toMatchObject({ excludeDishIds: [105] });

  // No dish left: the backend's NO_CANDIDATE becomes advice, and starting over is offered.
  await page.getByRole("button", { name: "Roll món khác" }).click();
  await expect(
    result(page).getByRole("heading", { name: "Hết món hợp điều kiện" }),
  ).toBeVisible();
  expect(rolls[2]).toMatchObject({ excludeDishIds: [105, 106] });
  await page.getByRole("button", { name: "Roll lại từ đầu" }).click();
  await expect(
    result(page).getByRole("heading", { name: "Bún bò Huế" }),
  ).toBeVisible();
  expect(rolls[3]).not.toHaveProperty("excludeDishIds");
});

test("changing a condition starts a new series", async ({ page }) => {
  await loginAs(page, "traveler");
  await page.goto("/roll");
  await rollButton(page).click();
  await expect(
    result(page).getByRole("heading", { name: "Bún bò Huế" }),
  ).toBeVisible();
  expect(rolls[0]).toEqual({});
  await page.getByLabel("Mức giá").selectOption("100000");
  await rollButton(page).click();
  await expect(
    result(page).getByRole("heading", { name: "Bún bò Huế" }),
  ).toBeVisible();
  expect(rolls[1]).toEqual({ maxPrice: 100000 });
});

test("nearby sends the browser position with its radius, never the province", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 16.061204, longitude: 108.227531 });
  await loginAs(page, "traveler");
  await page.goto("/roll");
  await page.getByLabel("Tỉnh / thành phố").fill("Thành phố Hà Nội");
  await page.getByRole("radio", { name: "Gần tôi" }).click();
  await expect(page.getByText(/Đã có vị trí hiện tại/)).toBeVisible();
  await page.getByLabel("Bán kính").selectOption("5");
  await rollButton(page).click();
  await expect(result(page)).toContainText("cách 1,2 km");
  expect(rolls).toEqual([
    { latitude: 16.061204, longitude: 108.227531, radiusKm: 5 },
  ]);
});

test("a blocked position explains what to do and goes back to the province", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  await page.goto("/roll");
  await page.getByRole("radio", { name: "Gần tôi" }).click();
  await expect(page.getByText(/chưa cho phép dùng vị trí/)).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "Theo tỉnh/thành" }),
  ).toHaveAttribute("aria-checked", "true");
  expect(rolls).toEqual([]);
});

test("a failed roll says why and can be tried again", async ({ page }) => {
  failRoll = true;
  await loginAs(page, "traveler");
  await page.goto("/roll");
  await rollButton(page).click();
  await expect(
    result(page).getByRole("heading", { name: "Chưa roll được món" }),
  ).toBeVisible();
  failRoll = false;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(
    result(page).getByRole("heading", { name: "Bún bò Huế" }),
  ).toBeVisible();
});

test("the roll screen fits a phone without sideways scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await loginAs(page, "traveler");
  await page.goto("/roll");
  await rollButton(page).click();
  await expect(
    result(page).getByRole("heading", { name: "Bún bò Huế" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
