import { expect, test, type Page } from "@playwright/test";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";
import type {
  AddRoadmapItemRequestDto,
  DishCardDto,
  MealSlot,
  RoadmapDetailDto,
  RoadmapItemDto,
  UpdateRoadmapItemRequestDto,
} from "../../src/features/roadmaps/roadmap-types";

/**
 * F-25: choosing the day and the place of a dish when it is added. RM-06 and RM-07 against a local
 * stub; like the backend, RM-07 gives the item exactly the `sortOrder` it is sent (it never shifts
 * the others) and RM-03 returns each day ordered by meal, `sortOrder` and id.
 */
const requestId = "6f0c2b1e-8d7a-4c1e-9b3f-2a5d7e9c1f00";
const slotOrder: MealSlot[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "late_night",
];

let detail: RoadmapDetailDto;
let calls: string[] = [];
let addCalls: { dayId: number; body: AddRoadmapItemRequestDto }[] = [];
let failPatch = false;
let nextId = 1700;

const restaurant = {
  id: 7,
  name: "Bún Bò Bà Diệu",
  district: "Quận Hoàn Kiếm",
  provinceName: "Thành phố Hà Nội",
  latitude: 21.0285,
  longitude: 105.8542,
  ratingAvg: 4.6,
};

const dishCard = (id: number, name: string): DishCardDto => ({
  id,
  name,
  price: 50000,
  coverUrl: null,
  dishForm: "soup",
  isAvailable: true,
  likeCount: 10,
  dislikeCount: 1,
  tags: [],
  restaurant: { ...restaurant, name: `Quán ${name}` },
  rank: 1,
});
const catalog = [
  dishCard(200, "Phở gà"),
  dishCard(201, "Bún riêu"),
  dishCard(202, "Bánh cuốn"),
];

const item = (
  id: number,
  dayId: number,
  mealSlot: MealSlot,
  sortOrder: number,
  name: string,
): RoadmapItemDto => ({
  id,
  dayId,
  dayNumber: dayId - 300,
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
  return {
    overview: {
      id: 88,
      title: "Đi chơi Hà Nội",
      startDate: "2026-10-10",
      endDate: "2026-10-12",
      numDays: 3,
      budgetAmount: 1500000,
      totalEstimatedCost: 135000,
      itemCount: 3,
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
        dayCost: 135000,
        items: [
          item(1502, 301, "lunch", 0, "Bún chả"),
          item(1503, 301, "lunch", 1, "Nem rán"),
          item(1504, 301, "lunch", 2, "Chả cá"),
        ],
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
      totalEstimatedCost: 135000,
      remaining: 1365000,
      isOverBudget: false,
      byDay: [
        { dayNumber: 1, cost: 135000 },
        { dayNumber: 2, cost: 0 },
        { dayNumber: 3, cost: 0 },
      ],
      byMealSlot: [],
    },
  };
}

function sortDays() {
  for (const day of detail.itinerary)
    day.items.sort(
      (a, b) =>
        slotOrder.indexOf(a.mealSlot) - slotOrder.indexOf(b.mealSlot) ||
        a.sortOrder - b.sortOrder ||
        a.id - b.id,
    );
}

const roadmaps: StubHandler = ({ method, url, body }, send) => {
  const parsed = new URL(url, "http://stub");
  const path = parsed.pathname;
  if (method === "GET" && path === "/api/v1/roadmaps/88") {
    send(200, detail);
    return true;
  }
  const route = /^\/api\/v1\/roadmaps\/88\/days\/(\d+)\/route$/.exec(path);
  if (method === "GET" && route) {
    send(200, {
      dayId: Number(route[1]),
      profile: "driving",
      origin: null,
      originSkipped: false,
      legs: [],
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      isEstimated: false,
    });
    return true;
  }
  if (method === "GET" && path === "/api/v1/roadmaps/88/suggestions") {
    const inRoadmap = new Set(
      detail.itinerary.flatMap((day) =>
        day.items.map((entry) => entry.dish.id),
      ),
    );
    send(200, {
      requestId,
      items: catalog.filter((dish) => !inRoadmap.has(dish.id)),
      nextCursor: null,
    });
    return true;
  }
  const patch = /^\/api\/v1\/roadmaps\/88\/items\/(\d+)$/.exec(path);
  if (method === "PATCH" && patch) {
    const request = body as UpdateRoadmapItemRequestDto;
    calls.push(`PATCH ${patch[1]} ${JSON.stringify(request)}`);
    if (failPatch) {
      send(503, null, "SERVICE_UNAVAILABLE");
      return true;
    }
    const target = detail.itinerary
      .flatMap((day) => day.items)
      .find((entry) => entry.id === Number(patch[1]));
    if (!target) {
      send(404, null, "ROADMAP_ITEM_NOT_FOUND");
      return true;
    }
    if (request.sortOrder !== undefined) target.sortOrder = request.sortOrder;
    sortDays();
    send(200, target);
    return true;
  }
  const add = /^\/api\/v1\/roadmaps\/88\/days\/(\d+)\/items$/.exec(path);
  if (method === "POST" && add) {
    const request = body as AddRoadmapItemRequestDto;
    const dayId = Number(add[1]);
    calls.push(`POST ${dayId} ${JSON.stringify(request)}`);
    addCalls.push({ dayId, body: request });
    const day = detail.itinerary.find((entry) => entry.dayId === dayId)!;
    const dish = catalog.find((entry) => entry.id === request.dishId)!;
    const sameMeal = day.items.filter(
      (entry) => entry.mealSlot === request.mealSlot,
    );
    // Omitted sortOrder = the end of the meal.
    const sortOrder =
      request.sortOrder ??
      (sameMeal.length ? Math.max(...sameMeal.map((e) => e.sortOrder)) + 1 : 0);
    nextId += 1;
    const created = item(nextId, dayId, request.mealSlot, sortOrder, dish.name);
    created.dish.id = dish.id;
    day.items.push(created);
    sortDays();
    send(201, created);
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
  calls = [];
  addCalls = [];
  failPatch = false;
  nextId = 1700;
  await page.route("**/api/locations/provinces", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [{ name: "Thành phố Hà Nội", code: 1 }],
      },
    }),
  );
});

const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Thêm món vào lộ trình" });
const dayField = (page: Page) =>
  dialog(page).getByLabel("Ngày", { exact: true });
const mealField = (page: Page) =>
  dialog(page).getByLabel("Bữa", { exact: true });
const placeField = (page: Page) =>
  dialog(page).getByLabel("Vị trí", { exact: true });
const addButton = (page: Page, dish: string, meal = "bữa trưa") =>
  dialog(page).getByRole("button", { name: `Thêm ${dish} vào ${meal}` });
// The connection lines are not shown (no origin), so a card's heading is its dish.
const names = async (page: Page, dayNumber = 1) =>
  (
    await page.locator(`#day-${dayNumber} .roadmap-item h5`).allTextContents()
  ).map((text) => text.replace(/^\d+/, "").trim());

async function open(page: Page) {
  await loginAs(page, "traveler");
  await page.goto("/roadmaps/88");
  await expect(
    page.getByRole("heading", { name: "Đi chơi Hà Nội", level: 1 }),
  ).toBeVisible();
  await page
    .locator("#day-1")
    .getByRole("button", { name: "Thêm món vào bữa trưa" })
    .click();
  await expect(dialog(page).locator(".roadmap-suggestion")).toHaveCount(3);
}

test("the dialog offers every day, the meal and the places of that meal", async ({
  page,
}) => {
  await open(page);
  // Opened from day 1, lunch; the list is not filtered by any of these.
  await expect(dayField(page)).toHaveValue("301");
  await expect(mealField(page)).toHaveValue("lunch");
  await expect(dayField(page).locator("option")).toHaveText([
    "Thứ Bảy, 10 tháng 10",
    "Chủ Nhật, 11 tháng 10",
    "Thứ Hai, 12 tháng 10",
  ]);
  await expect(placeField(page).locator("option")).toHaveText([
    "Đầu bữa",
    "Sau Bún chả",
    "Sau Nem rán",
    "Cuối bữa",
  ]);
  await expect(placeField(page)).toHaveValue("end");
  // A meal with no dish has only one place.
  await mealField(page).selectOption("dinner");
  await expect(placeField(page).locator("option")).toHaveText(["Cuối bữa"]);
  await dayField(page).selectOption("302");
  await mealField(page).selectOption("lunch");
  await expect(placeField(page).locator("option")).toHaveText(["Cuối bữa"]);
  expect(calls).toEqual([]);
});

test("the end of the meal is the default: no sortOrder and nothing moved", async ({
  page,
}) => {
  await open(page);
  await addButton(page, "Phở gà").click();
  await expect.poll(() => addCalls.length).toBe(1);
  expect(addCalls[0]).toEqual({
    dayId: 301,
    body: { dishId: 200, mealSlot: "lunch", recoRequestId: requestId },
  });
  expect(calls.filter((call) => call.startsWith("PATCH"))).toEqual([]);
  await expect
    .poll(async () => names(page))
    .toEqual(["Bún chả", "Nem rán", "Chả cá", "Phở gà"]);
});

test("a chosen place makes room with RM-08 first, then adds with that sortOrder", async ({
  page,
}) => {
  await open(page);
  await placeField(page).selectOption("after:1502");
  await addButton(page, "Phở gà").click();
  await expect.poll(() => addCalls.length).toBe(1);
  // The dishes after the place move one step later (the furthest first), then RM-07.
  expect(calls).toEqual([
    'PATCH 1504 {"sortOrder":3}',
    'PATCH 1503 {"sortOrder":2}',
    `POST 301 {"dishId":200,"mealSlot":"lunch","sortOrder":1,"recoRequestId":"${requestId}"}`,
  ]);
  await expect
    .poll(async () => names(page))
    .toEqual(["Bún chả", "Phở gà", "Nem rán", "Chả cá"]);
  await expect(
    dialog(page).getByRole("button", { name: "Phở gà: đã thêm vào bữa trưa" }),
  ).toBeVisible();

  // The next dish follows the one just added.
  await expect(placeField(page)).toHaveValue(/^after:/);
  await addButton(page, "Bún riêu").click();
  await expect.poll(() => addCalls.length).toBe(2);
  await expect
    .poll(async () => names(page))
    .toEqual(["Bún chả", "Phở gà", "Bún riêu", "Nem rán", "Chả cá"]);
});

test("the start of a meal and another day are honoured", async ({ page }) => {
  await open(page);
  await placeField(page).selectOption("start");
  await addButton(page, "Bún riêu").click();
  await expect.poll(() => addCalls.length).toBe(1);
  expect(addCalls[0].body.sortOrder).toBe(0);
  expect(calls.filter((call) => call.startsWith("PATCH"))).toEqual([
    'PATCH 1504 {"sortOrder":3}',
    'PATCH 1503 {"sortOrder":2}',
    'PATCH 1502 {"sortOrder":1}',
  ]);
  await expect
    .poll(async () => names(page))
    .toEqual(["Bún riêu", "Bún chả", "Nem rán", "Chả cá"]);

  // Day 2: the dish goes to that day, the day the dialog was opened from is untouched.
  await dayField(page).selectOption("302");
  await mealField(page).selectOption("dinner");
  await addButton(page, "Bánh cuốn", "bữa tối").click();
  await expect.poll(() => addCalls.length).toBe(2);
  expect(addCalls[1]).toEqual({
    dayId: 302,
    body: { dishId: 202, mealSlot: "dinner", recoRequestId: requestId },
  });
  await expect(page.locator("#day-1 .roadmap-item")).toHaveCount(4);
  await dialog(page).getByRole("button", { name: "Xong" }).click();
  await page.getByRole("button", { name: "Chủ Nhật, 11 tháng 10" }).click();
  await expect(page.locator("#day-2 .roadmap-item")).toHaveCount(1);
});

test("a failure while making room adds nothing and says so", async ({
  page,
}) => {
  await open(page);
  failPatch = true;
  await placeField(page).selectOption("start");
  await addButton(page, "Phở gà").click();
  await expect(
    dialog(page).locator(".roadmap-suggestion").first().getByRole("alert"),
  ).toContainText("Hiện chưa kết nối được với hệ thống.");
  expect(addCalls).toEqual([]);
  expect(await names(page)).toEqual(["Bún chả", "Nem rán", "Chả cá"]);
});

test("each suggested place links to Google Maps by its coordinates", async ({
  page,
}) => {
  await open(page);
  const link = dialog(page)
    .getByRole("link", { name: /Xem quán trên Google Maps/ })
    .first();
  await expect(link).toHaveAttribute(
    "href",
    "https://www.google.com/maps/search/?api=1&query=21.0285,105.8542",
  );
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
});

test("the three selects fit from 320px to 1440px", async ({ page }) => {
  await open(page);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await dialog(page).evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
      `dialog ${width}px`,
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `page ${width}px`,
    ).toBe(true);
  }
});
