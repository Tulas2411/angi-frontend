import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";
import type {
  DishCardDto,
  DishDetailDto,
} from "../../src/features/explore/explore-types";

/**
 * F-18 "Hôm nay ăn gì?" (ducbui's layout) against a local stub shaped like DISH-01, DISH-03 and
 * CAT-02 (API Design v1.8). The stub plays the backend's rules: excluded dishes are never rolled,
 * and 404 NO_CANDIDATE when none is left. Nothing reaches Mapbox or a shared backend.
 */
let rolls: Record<string, unknown>[] = [];
let browses: URLSearchParams[] = [];
let failRoll = false;
let detailReads: number[] = [];
let failDetail: "unavailable" | "missing" | null = null;
let tags = [
  { id: 1, tagType: "meal_time", code: "snack", name: "Ăn vặt" },
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
    tags: [],
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
const card = (id: number, name: string, price: number): DishCardDto => ({
  ...dish(id, name, price),
  coverUrl: "/assets/figma/dish-0.png",
  restaurant: {
    id: 7,
    name: "Bún Bò Bà Diệu",
    district: null,
    provinceName: "Thành phố Đà Nẵng",
    latitude: null,
    longitude: null,
    ratingAvg: 4.6,
  },
});
const strip = [
  card(201, "Phở bò tái", 55000),
  card(202, "Bánh xèo", 35000),
  card(203, "Cơm gà", 40000),
  card(204, "Bánh cuốn", 30000),
];

const handler: StubHandler = (request, send) => {
  const url = new URL(request.url, "http://stub");
  if (url.pathname === "/api/v1/tags") {
    send(200, tags);
    return true;
  }
  if (url.pathname === "/api/v1/dishes" && request.method === "GET") {
    browses.push(url.searchParams);
    send(200, { requestId: null, items: strip, nextCursor: null });
    return true;
  }
  const detailMatch = /^\/api\/v1\/dishes\/(\d+)$/.exec(url.pathname);
  if (detailMatch && request.method === "GET") {
    const id = Number(detailMatch[1]);
    detailReads.push(id);
    if (failDetail) {
      send(
        failDetail === "missing" ? 404 : 503,
        null,
        failDetail === "missing" ? "DISH_NOT_FOUND" : "SERVICE_UNAVAILABLE",
      );
      return true;
    }
    const entry = [...strip, ...menu].find((item) => item.id === id);
    if (!entry) send(404, null, "DISH_NOT_FOUND");
    else
      send(200, {
        ...dish(entry.id, entry.name, entry.price),
        coverUrl: "/assets/figma/dish-0.png",
        images: ["/assets/figma/roll-0.png"],
      });
    return true;
  }
  if (url.pathname === "/api/v1/dishes/roll" && request.method === "POST") {
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
        dish: next,
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
  rolls = [];
  browses = [];
  failRoll = false;
  detailReads = [];
  failDetail = null;
  tags = [
    { id: 1, tagType: "meal_time", code: "snack", name: "Ăn vặt" },
    { id: 5, tagType: "dietary", code: "vegetarian", name: "Món chay" },
  ];
  // The strip's spin is skipped so every roll answers at once.
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const result = (page: Page) => page.locator(".roll-result");
const tab = (page: Page, name: string) =>
  page.getByRole("tab", { name, exact: true });

test("only a traveler rolls; the account menu and the old demo route lead there", async ({
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
  await expect(page).toHaveURL(/:3001\/roll$/);
  await expect(
    page.getByRole("heading", { name: "Hôm nay ăn gì?", level: 1 }),
  ).toBeVisible();
  await page.goto("/demo/traveler/roll");
  await expect(page).toHaveURL(/:3001\/roll$/);
});

test("the strip shows real dishes and the rolled dish lands under the marker", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  await page.goto("/roll");
  await expect(page.locator(".roll-card h3").first()).toHaveText("Phở bò tái");
  expect(browses[0]?.get("limit")).toBe("8");
  await page.getByRole("button", { name: "Roll món ngay" }).click();

  await expect(
    result(page).getByRole("heading", { name: "Chốt món này nhé!" }),
  ).toBeVisible();
  await expect(
    result(page).getByRole("heading", { name: "Bún bò Huế" }),
  ).toBeVisible();
  await expect(result(page)).toContainText("Khoảng 45.000");
  await expect(result(page)).toContainText(
    "Bún Bò Bà Diệu · Thành phố Đà Nẵng · 4,6 sao",
  );
  await expect(page.locator(".roll-card.is-selected h3")).toHaveText(
    "Bún bò Huế",
  );
  await expect(page.locator(".roll-card")).toHaveCount(5);
  await expect(
    result(page).getByRole("link", { name: "Xem quán ăn" }),
  ).toHaveAttribute("href", "/restaurants/7");
  await expect(
    result(page).getByRole("link", { name: "Xem món" }),
  ).toHaveAttribute("href", "/dishes/105");
  expect(rolls).toEqual([{}]);

  // "Roll lại" leaves out what was shown; with nothing left the backend says NO_CANDIDATE.
  await page.getByRole("button", { name: "Roll lại" }).click();
  await expect(
    result(page).getByRole("heading", { name: "Mì Quảng" }),
  ).toBeVisible();
  expect(rolls[1]).toEqual({ excludeDishIds: [105] });
  await page.getByRole("button", { name: "Roll lại" }).click();
  await expect(
    page.getByText(/Không còn món nào hợp lựa chọn này/),
  ).toBeVisible();
  expect(rolls[2]).toEqual({ excludeDishIds: [105, 106] });
  await page.getByRole("button", { name: "Roll lại từ đầu" }).click();
  await expect(
    result(page).getByRole("heading", { name: "Bún bò Huế" }),
  ).toBeVisible();
  expect(rolls[3]).toEqual({});
});

test("each tab sends its own conditions and starts a new series", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  await page.goto("/roll");
  await expect(page.locator(".roll-card").first()).toBeVisible();

  await tab(page, "✓ Dưới 50k").click();
  await page.getByRole("button", { name: "Roll món ngay" }).click();
  await expect(result(page)).toBeVisible();
  expect(rolls.at(-1)).toEqual({ maxPrice: 50000 });
  expect(browses.at(-1)?.get("maxPrice")).toBe("50000");

  await tab(page, "Ăn nhẹ").click();
  await expect(result(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Roll món ngay" }).click();
  await expect(result(page)).toBeVisible();
  expect(rolls.at(-1)).toEqual({ mealTime: "snack" });
  expect(browses.at(-1)?.getAll("tagIds")).toEqual(["1"]);

  await tab(page, "Ăn chay").click();
  await page.getByRole("button", { name: "Roll món ngay" }).click();
  await expect(result(page)).toBeVisible();
  expect(rolls.at(-1)).toEqual({ tagIds: [5] });
});

test("without a vegetarian tag the tab says so instead of rolling", async ({
  page,
}) => {
  tags = [{ id: 1, tagType: "meal_time", code: "snack", name: "Ăn vặt" }];
  await loginAs(page, "traveler");
  await page.goto("/roll");
  await tab(page, "Ăn chay").click();
  await expect(
    page.getByRole("heading", { name: "Chưa có thẻ món chay" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Roll món ngay" })).toHaveCount(
    0,
  );
  expect(rolls).toEqual([]);
});

test("a failed roll says why and the retry keeps the series", async ({
  page,
}) => {
  failRoll = true;
  await loginAs(page, "traveler");
  await page.goto("/roll");
  await page.getByRole("button", { name: "Roll món ngay" }).click();
  await expect(page.locator(".roll-actions").getByRole("alert")).toBeVisible();
  failRoll = false;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(
    result(page).getByRole("heading", { name: "Bún bò Huế" }),
  ).toBeVisible();
});

test("cards follow the homepage: no outline, a soft shadow, the heading face", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  await page.goto("/roll");
  // A real dish card, once DISH-01 has filled the strip (blank cards turn until then).
  const first = page.locator(".roll-card:not(.roll-card-blank)").first();
  await expect(first.locator("h3")).toHaveText("Phở bò tái");
  const style = await first.evaluate((element) => {
    const css = getComputedStyle(element);
    const heading = getComputedStyle(element.querySelector("h3")!);
    return {
      border: css.borderTopWidth,
      shadow: css.boxShadow,
      radius: css.borderTopLeftRadius,
      font: heading.fontFamily,
    };
  });
  expect(style.border).toBe("0px");
  expect(style.shadow).not.toBe("none");
  expect(style.radius).toBe("24px");
  expect(style.font).toMatch(/Fraunces/);
});

test("the roll screen fits a phone without sideways scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await loginAs(page, "traveler");
  await page.goto("/roll");
  await page.getByRole("button", { name: "Roll món ngay" }).click();
  await expect(
    result(page).getByRole("heading", { name: "Bún bò Huế" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("hover and keyboard focus lift a card and gently blur neighbors without darkening or fading them", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  await page.goto("/roll");
  const cards = page.locator(".roll-strip").first().locator(".roll-card");
  await expect(cards.first().locator("h3")).toHaveText("Phở bò tái");
  const first = cards
    .first()
    .getByRole("button", { name: "Xem chi tiết Phở bò tái", exact: true });
  await first.hover();
  await expect(cards.nth(1)).toHaveCSS("filter", "blur(3px)");
  await expect(cards.nth(1)).toHaveCSS("opacity", "1");
  await expect(cards.first()).not.toHaveCSS("filter", "blur(3px)");
  expect(detailReads).toEqual([]);
  await page.getByRole("heading", { name: "Hôm nay ăn gì?", level: 1 }).hover();
  await first.focus();
  await page.keyboard.press("Tab");
  const second = cards
    .nth(1)
    .getByRole("button", { name: "Xem chi tiết Bánh xèo", exact: true });
  await expect(second).toBeFocused();
  await expect(cards.first()).toHaveCSS("filter", "blur(3px)");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Bánh xèo", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(second).toBeFocused();
  expect(detailReads).toEqual([202]);
  expect(rolls).toEqual([]);
});

test("a card opens a real DISH-02 modal with photos and restaurant links, and closing preserves the roll", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  await page.goto("/roll");
  await expect(page.getByRole("button", { name: /^Xem chi tiết/ })).toHaveCount(
    4,
  );
  const trigger = page.getByRole("button", {
    name: "Xem chi tiết Phở bò tái",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Phở bò tái", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("55.000");
  await expect(dialog).toContainText(
    "Nước dùng ninh xương bò, sả và mắm ruốc.",
  );
  await expect(
    dialog.getByRole("link", { name: "Xem quán ăn", exact: true }),
  ).toHaveAttribute("href", "/restaurants/7");
  await expect(
    dialog.getByRole("link", { name: "Mở trang món ăn ↗", exact: true }),
  ).toHaveAttribute("href", "/dishes/201");
  await dialog
    .getByRole("button", { name: "Xem ảnh 2 của Phở bò tái", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", {
      name: "Xem ảnh 2 của Phở bò tái",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await dialog
    .getByRole("button", { name: "Tiếp tục roll", exact: true })
    .click();
  await expect(trigger).toBeFocused();
  expect(rolls).toEqual([]);
  await page
    .getByRole("button", { name: "Roll món ngay", exact: true })
    .click();
  await expect(result(page)).toBeVisible();
  await page
    .getByRole("button", { name: "Xem chi tiết Bún bò Huế", exact: true })
    .click();
  const chosen = page.getByRole("dialog", { name: "Bún bò Huế", exact: true });
  await expect(chosen).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(result(page)).toBeVisible();
  expect(rolls).toHaveLength(1);
  expect(detailReads).toEqual([201, 105]);
});

test("dish detail errors retry the read, and removed dishes never show fixture fallback data", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  await page.goto("/roll");
  failDetail = "unavailable";
  await page
    .getByRole("button", { name: "Xem chi tiết Phở bò tái", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Phở bò tái", exact: true });
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(
    dialog.getByText("Nước dùng ninh xương bò, sả và mắm ruốc.", {
      exact: true,
    }),
  ).toHaveCount(0);
  failDetail = null;
  await dialog.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(
    dialog.getByRole("link", { name: "Xem quán ăn", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  failDetail = "missing";
  await page
    .getByRole("button", { name: "Xem chi tiết Phở bò tái", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Món này không còn hiển thị hoặc đã được gỡ khỏi ANGI.",
  );
  await expect(
    dialog.getByRole("link", { name: "Xem quán ăn", exact: true }),
  ).toHaveCount(0);
  expect(rolls).toEqual([]);
  expect(detailReads).toEqual([201, 201, 201]);
});

test("card focus and dish modal fit desktop/mobile and respect reduced motion", async ({
  page,
}) => {
  const shots = join(tmpdir(), "angi-roll-card-preview");
  await mkdir(shots, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAs(page, "traveler");
  await page.goto("/roll");
  await page
    .getByRole("button", { name: "Xem chi tiết Bánh xèo", exact: true })
    .hover();
  await page.screenshot({
    path: join(shots, "roll-card-focus-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Xem chi tiết Phở bò tái", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Phở bò tái", exact: true });
  await expect(
    dialog.getByRole("link", { name: "Xem quán ăn", exact: true }),
  ).toBeVisible();
  expect(
    await dialog.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).toBe("0s");
  await page.screenshot({ path: join(shots, "roll-dish-modal-desktop.png") });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: join(shots, `roll-dish-modal-${width}.png`),
    });
  }
});
