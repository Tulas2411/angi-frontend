import { expect, test, type Page } from "@playwright/test";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";
import type {
  MealSlot,
  RoadmapDetailDto,
  RoadmapItemDto,
  UpdateRoadmapItemRequestDto,
} from "../../src/features/roadmaps/roadmap-types";

/**
 * F-27: reordering dishes with RM-08 against a local stub shaped like the API Design JSON
 * samples. Like the backend, the stub changes only the item it is told to change and RM-03
 * returns the day ordered by meal, `sortOrder` and id.
 */
const slotOrder: MealSlot[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "late_night",
];

let detail: RoadmapDetailDto;
let patchCalls: { itemId: number; body: UpdateRoadmapItemRequestDto }[] = [];
let detailReads = 0;
let routeCalls: string[] = [];
let failPatch: { status: number; errorCode: string } | null = null;

const restaurant = {
  id: 7,
  name: "Bún Bò Bà Diệu",
  district: "Quận Hoàn Kiếm",
  provinceName: "Thành phố Hà Nội",
  latitude: 21.0285,
  longitude: 105.8542,
  ratingAvg: 4.6,
};

const item = (
  id: number,
  mealSlot: MealSlot,
  sortOrder: number,
  name: string,
): RoadmapItemDto => ({
  id,
  dayId: 301,
  dayNumber: 1,
  mealSlot,
  sortOrder,
  source: "manual",
  recoRequestId: null,
  myFeedback: null,
  createdAt: "2026-10-25T02:10:00Z",
  dish: {
    id: id + 100,
    name,
    price: 45000,
    coverUrl: null,
    dishForm: "soup",
    isAvailable: true,
    likeCount: 12,
    dislikeCount: 1,
    tags: [],
    restaurant,
    status: "active",
    rank: null,
  },
});

function baseDetail(): RoadmapDetailDto {
  const items = [
    item(1501, "breakfast", 0, "Phở bò"),
    item(1502, "lunch", 0, "Bún chả"),
    item(1503, "lunch", 1, "Nem rán"),
    item(1504, "lunch", 2, "Chả cá"),
    item(1505, "dinner", 0, "Lẩu bò"),
  ];
  return {
    overview: {
      id: 88,
      title: "Đi chơi Hà Nội",
      startDate: "2026-10-10",
      endDate: "2026-10-12",
      numDays: 3,
      budgetAmount: 1500000,
      totalEstimatedCost: 225000,
      itemCount: 5,
      coverUrl: null,
      originMode: "none",
      originLatitude: null,
      originLongitude: null,
      originLabel: null,
      createdAt: "2026-10-25T02:00:00Z",
      updatedAt: "2026-10-25T03:00:00Z",
    },
    itinerary: [
      {
        dayId: 301,
        dayNumber: 1,
        date: "2026-10-10",
        note: null,
        dayCost: 225000,
        items,
      },
      {
        dayId: 302,
        dayNumber: 2,
        date: "2026-10-11",
        note: null,
        dayCost: 0,
        items: [],
      },
      {
        dayId: 303,
        dayNumber: 3,
        date: "2026-10-12",
        note: null,
        dayCost: 0,
        items: [],
      },
    ],
    budget: {
      budgetAmount: 1500000,
      totalEstimatedCost: 225000,
      remaining: 1275000,
      isOverBudget: false,
      byDay: [
        { dayNumber: 1, cost: 225000 },
        { dayNumber: 2, cost: 0 },
        { dayNumber: 3, cost: 0 },
      ],
      byMealSlot: [],
    },
  };
}

const roadmaps: StubHandler = ({ method, url, body }, send) => {
  const path = new URL(url, "http://stub").pathname;
  if (method === "GET" && path === "/api/v1/roadmaps/88") {
    detailReads += 1;
    send(200, detail);
    return true;
  }
  const route = /^\/api\/v1\/roadmaps\/88\/days\/(\d+)\/route$/.exec(path);
  if (method === "GET" && route) {
    routeCalls.push(
      detail.itinerary[0].items.map((entry) => entry.id).join(","),
    );
    // The legs follow the order the day has right now, like the backend's RM-14.
    const items = Number(route[1]) === 301 ? detail.itinerary[0].items : [];
    const legs = items.map((entry, index, all) => ({
      fromItemId: index === 0 ? null : all[index - 1].id,
      toItemId: entry.id,
      distanceMeters: 1000 * (index + 1),
      durationSeconds: 300 * (index + 1),
    }));
    send(200, {
      dayId: Number(route[1]),
      profile: "driving",
      origin: null,
      originSkipped: false,
      legs,
      totalDistanceMeters: legs.reduce((s, l) => s + l.distanceMeters, 0),
      totalDurationSeconds: legs.reduce((s, l) => s + l.durationSeconds, 0),
      isEstimated: false,
    });
    return true;
  }
  const patch = /^\/api\/v1\/roadmaps\/88\/items\/(\d+)$/.exec(path);
  if (method === "PATCH" && patch) {
    const itemId = Number(patch[1]);
    const request = body as UpdateRoadmapItemRequestDto;
    patchCalls.push({ itemId, body: request });
    if (failPatch) {
      const failure = failPatch;
      failPatch = null;
      send(failure.status, null, failure.errorCode);
      return true;
    }
    const day = detail.itinerary[0];
    const target = day.items.find((entry) => entry.id === itemId);
    if (!target) {
      send(404, null, "ROADMAP_ITEM_NOT_FOUND");
      return true;
    }
    // RM-08 changes only this item; the others keep their own sortOrder.
    if (request.mealSlot) target.mealSlot = request.mealSlot;
    if (request.sortOrder !== undefined) target.sortOrder = request.sortOrder;
    day.items.sort(
      (a, b) =>
        slotOrder.indexOf(a.mealSlot) - slotOrder.indexOf(b.mealSlot) ||
        a.sortOrder - b.sortOrder ||
        a.id - b.id,
    );
    send(200, target);
    return true;
  }
  return false;
};

let stub: AccountStub;
test.beforeAll(async () => {
  stub = await startAccountStub(5164, roadmaps);
});
test.afterAll(async () => {
  await stopAccountStub(stub);
});
test.beforeEach(async ({ page }) => {
  stub.reset();
  detail = baseDetail();
  patchCalls = [];
  detailReads = 0;
  routeCalls = [];
  failPatch = null;
  await page.setViewportSize({ width: 1440, height: 3000 });
});

const cards = (page: Page) => page.locator("#day-1 .roadmap-item h5");
const grip = (page: Page, dish: string) =>
  page.getByRole("button", { name: `Đổi thứ tự ${dish}` });
// The connection lines inside a row name other dishes, so the row is found by its own title.
const row = (page: Page, dish: string) =>
  page.locator("#day-1 li[data-item-id]").filter({
    has: page.getByRole("heading", { name: dish, exact: true, level: 5 }),
  });
const order = async (page: Page) =>
  (await cards(page).allTextContents()).map((text) =>
    text.replace(/^\d+/, "").trim(),
  );

async function open(page: Page) {
  await loginAs(page, "traveler");
  await page.goto("/roadmaps/88");
  await expect(
    page.getByRole("heading", { name: "Đi chơi Hà Nội", level: 1 }),
  ).toBeVisible();
  await expect(cards(page)).toHaveCount(5);
}

/** Press the grip of `dish`, drag it to `y` (page coordinates of the viewport) and release. */
async function drag(page: Page, dish: string, y: number, release = true) {
  const box = (await grip(page, dish).boundingBox())!;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 8 });
  if (release) await page.mouse.up();
}

test("every dish has a grip at the top right of its card", async ({ page }) => {
  await open(page);
  await expect(page.locator("#day-1 .roadmap-item-grip")).toHaveCount(5);
  const grip1 = (await grip(page, "Phở bò").boundingBox())!;
  const card = (await page
    .locator("#day-1 .roadmap-item-text")
    .first()
    .boundingBox())!;
  expect(card.x + card.width - (grip1.x + grip1.width)).toBeLessThan(24);
  expect(grip1.y - card.y).toBeLessThan(24);
  expect(await order(page)).toEqual([
    "Phở bò",
    "Bún chả",
    "Nem rán",
    "Chả cá",
    "Lẩu bò",
  ]);
});

test("dragging a dish above another one in its meal saves RM-08 and reloads RM-03", async ({
  page,
}) => {
  await open(page);
  expect(detailReads).toBe(1);
  const target = (await row(page, "Bún chả").boundingBox())!;
  await drag(page, "Chả cá", target.y + 4, false);
  // The drop line shows where it will land while the pointer is still down.
  await expect(page.locator(".roadmap-drop-indicator")).toBeVisible();
  await page.mouse.up();

  await expect.poll(() => patchCalls.length).toBe(3);
  // The moved dish first, then every dish it pushed down gets its new position.
  expect(patchCalls).toEqual([
    { itemId: 1504, body: { sortOrder: 0 } },
    { itemId: 1502, body: { sortOrder: 1 } },
    { itemId: 1503, body: { sortOrder: 2 } },
  ]);
  await expect.poll(() => detailReads).toBe(2);
  await expect(page.locator(".roadmap-drop-indicator")).toHaveCount(0);
  expect(await order(page)).toEqual([
    "Phở bò",
    "Chả cá",
    "Bún chả",
    "Nem rán",
    "Lẩu bò",
  ]);
  await expect(
    page.getByRole("status").filter({ hasText: "Đã chuyển Chả cá" }),
  ).toBeAttached();
});

test("only the card follows the pointer; the connection lines stay and are worked out again after the drop", async ({
  page,
}) => {
  await open(page);
  await expect.poll(() => routeCalls.length).toBe(1);
  const legs = page.locator("#day-1 .roadmap-leg");
  await expect(legs.first()).toBeVisible();
  const legBefore = (await legs.first().boundingBox())!;
  const cardBefore = (await row(page, "Chả cá")
    .locator(".roadmap-item")
    .boundingBox())!;
  const target = (await row(page, "Bún chả").boundingBox())!;
  await drag(page, "Chả cá", target.y + 4, false);
  const cardWhile = (await row(page, "Chả cá")
    .locator(".roadmap-item")
    .boundingBox())!;
  // The card lifted and moved up with the pointer…
  expect(cardWhile.y).toBeLessThan(cardBefore.y - 100);
  // …while the connection line of the first dish did not move.
  const legWhile = (await legs.first().boundingBox())!;
  expect(legWhile.y).toBe(legBefore.y);
  await expect(row(page, "Chả cá").locator(".roadmap-item")).toHaveClass(
    /is-dragging/,
  );
  await page.mouse.up();
  await expect.poll(() => patchCalls.length).toBe(3);
  // RM-14 is asked again for the new order, so the distances are the backend's.
  await expect.poll(() => routeCalls.length).toBe(2);
  expect(routeCalls[1]).toBe("1501,1504,1502,1503,1505");
  await expect(page.locator("#day-1 .roadmap-leg").first()).toBeVisible();
  await expect(row(page, "Chả cá").locator(".roadmap-item")).not.toHaveClass(
    /is-dragging/,
  );
});

test("dropping a dish into another meal changes its meal", async ({ page }) => {
  await open(page);
  const breakfast = (await row(page, "Phở bò").boundingBox())!;
  await drag(page, "Lẩu bò", breakfast.y + breakfast.height - 3);
  await expect.poll(() => patchCalls.length).toBe(1);
  expect(patchCalls[0]).toEqual({
    itemId: 1505,
    body: { mealSlot: "breakfast", sortOrder: 1 },
  });
  await expect.poll(() => detailReads).toBe(2);
  expect(await order(page)).toEqual([
    "Phở bò",
    "Lẩu bò",
    "Bún chả",
    "Nem rán",
    "Chả cá",
  ]);
  // The dinner band is gone: its only dish left it.
  await expect(
    page.getByRole("heading", { name: "Bữa tối", level: 4 }),
  ).toHaveCount(0);
});

test("Escape or a click without moving sends nothing", async ({ page }) => {
  await open(page);
  const target = (await row(page, "Bún chả").boundingBox())!;
  await drag(page, "Chả cá", target.y + 4, false);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".roadmap-drop-indicator")).toHaveCount(0);
  const box = (await grip(page, "Nem rán").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  // Back where it started, or a tiny wobble within its own place: nothing to save.
  await drag(page, "Nem rán", box.y + box.height / 2 + 6);
  expect(patchCalls).toEqual([]);
  expect(detailReads).toBe(1);
  expect(await order(page)).toEqual([
    "Phở bò",
    "Bún chả",
    "Nem rán",
    "Chả cá",
    "Lẩu bò",
  ]);
});

test("the arrow keys move a dish one place and keep the focus on its grip", async ({
  page,
}) => {
  await open(page);
  await grip(page, "Bún chả").focus();
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => patchCalls.length).toBe(2);
  expect(patchCalls).toEqual([
    { itemId: 1502, body: { sortOrder: 1 } },
    { itemId: 1503, body: { sortOrder: 0 } },
  ]);
  await expect.poll(() => detailReads).toBe(2);
  expect(await order(page)).toEqual([
    "Phở bò",
    "Nem rán",
    "Bún chả",
    "Chả cá",
    "Lẩu bò",
  ]);
  await expect(grip(page, "Bún chả")).toBeFocused();

  // At the end of a meal the next press goes into the next meal.
  await grip(page, "Chả cá").focus();
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => patchCalls.length).toBe(4);
  expect(patchCalls[2]).toEqual({
    itemId: 1504,
    body: { mealSlot: "dinner", sortOrder: 0 },
  });
  await expect.poll(() => detailReads).toBe(3);
  await expect(grip(page, "Chả cá")).toBeFocused();
  expect(await order(page)).toEqual([
    "Phở bò",
    "Nem rán",
    "Bún chả",
    "Chả cá",
    "Lẩu bò",
  ]);

  // The first and the last dish of the day have nowhere to go.
  const before = patchCalls.length;
  await grip(page, "Phở bò").focus();
  await page.keyboard.press("ArrowUp");
  await grip(page, "Lẩu bò").focus();
  await page.keyboard.press("ArrowDown");
  expect(patchCalls).toHaveLength(before);
});

test("a failed save puts the order back, says why and reads the roadmap again", async ({
  page,
}) => {
  await open(page);
  failPatch = { status: 503, errorCode: "SERVICE_UNAVAILABLE" };
  const target = (await row(page, "Bún chả").boundingBox())!;
  await drag(page, "Chả cá", target.y + 4);
  await expect(page.locator(".roadmap-day-notice")).toContainText(
    "Chưa lưu được thứ tự mới",
  );
  // The failed call was the first and only one; RM-03 was read again to show the truth.
  expect(patchCalls).toHaveLength(1);
  await expect.poll(() => detailReads).toBe(2);
  expect(await order(page)).toEqual([
    "Phở bò",
    "Bún chả",
    "Nem rán",
    "Chả cá",
    "Lẩu bò",
  ]);
});

test("a dish removed elsewhere is reported and the list refreshed", async ({
  page,
}) => {
  await open(page);
  detail.itinerary[0].items = detail.itinerary[0].items.filter(
    (entry) => entry.id !== 1504,
  );
  const target = (await row(page, "Bún chả").boundingBox())!;
  await drag(page, "Chả cá", target.y + 4);
  await expect(page.locator(".roadmap-day-notice")).toContainText(
    "không còn trong lộ trình",
  );
  await expect(cards(page)).toHaveCount(4);
});

test("the grip works on a narrow screen without horizontal scroll", async ({
  page,
}) => {
  await open(page);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 3000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `page ${width}px`,
    ).toBe(true);
    const box = (await grip(page, "Phở bò").boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(32);
    expect(box.x).toBeGreaterThanOrEqual(0);
  }
});
