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
} from "../../src/features/roadmaps/roadmap-types";

/**
 * F-24: RM-06 and RM-07, F-28: RM-09 against a local stub shaped like the API Design JSON samples.
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
let suggestionCalls: string[] = [];
let addCalls: { dayId: number; body: AddRoadmapItemRequestDto }[] = [];
let routeCalls: string[] = [];
let failSuggestions = 0;
let failAdd: { status: number; errorCode: string } | null = null;
let failDetailReads = 0;
let detailReads = 0;
let expireNextCursor = false;
let deleteCalls: number[] = [];
let failDelete: { status: number; errorCode: string } | null = null;
let itemGoneElsewhere = false;

const restaurant = (name: string, latitude: number, longitude: number) => ({
  id: 7,
  name,
  district: "Quận Hải Châu",
  provinceName: "Thành phố Đà Nẵng",
  latitude,
  longitude,
  ratingAvg: 4.6,
});

/** 30 ranked dishes of Đà Nẵng, the shape of the RM-06 JSON sample. */
const catalog: DishCardDto[] = Array.from({ length: 30 }, (_, index) => ({
  id: 200 + index,
  name: index === 0 ? "Mì Quảng ếch" : `Món gợi ý ${index + 1}`,
  price: 30000 + index * 5000,
  coverUrl: null,
  dishForm: "soup" as const,
  isAvailable: true,
  likeCount: 12,
  dislikeCount: 1,
  tags: [
    { id: 2, tagType: "meal_time" as const, code: "lunch", name: "Bữa trưa" },
  ],
  restaurant: restaurant(`Quán số ${index + 1}`, 16.06 + index / 1000, 108.22),
  rank: index + 1,
}));

function baseDetail(): RoadmapDetailDto {
  const breakfast = (): RoadmapItemDto => ({
    id: 1502,
    dayId: 301,
    dayNumber: 1,
    mealSlot: "breakfast",
    sortOrder: 0,
    source: "manual",
    recoRequestId: null,
    myFeedback: null,
    createdAt: "2026-10-02T02:10:00Z",
    dish: {
      id: 105,
      name: "Bún bò Huế",
      price: 45000,
      coverUrl: null,
      dishForm: "soup",
      isAvailable: true,
      likeCount: 128,
      dislikeCount: 9,
      tags: [],
      restaurant: restaurant("Bún Bò Bà Diệu", 16.067812, 108.220116),
      status: "active",
      rank: null,
    },
  });
  return {
    overview: {
      id: 88,
      title: "3 ngày ăn sập Đà Nẵng",
      startDate: "2026-10-10",
      endDate: "2026-10-12",
      numDays: 3,
      budgetAmount: 1500000,
      totalEstimatedCost: 45000,
      itemCount: 1,
      coverUrl: null,
      originMode: "pinned",
      originLatitude: 16.061204,
      originLongitude: 108.227531,
      originLabel: "Khách sạn Sala Đà Nẵng",
      createdAt: "2026-10-02T02:00:00Z",
      updatedAt: "2026-10-02T03:00:00Z",
    },
    itinerary: [
      {
        dayId: 301,
        dayNumber: 1,
        date: "2026-10-10",
        note: null,
        dayCost: 45000,
        items: [breakfast()],
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
      totalEstimatedCost: 45000,
      remaining: 1455000,
      isOverBudget: false,
      byDay: [
        { dayNumber: 1, cost: 45000 },
        { dayNumber: 2, cost: 0 },
        { dayNumber: 3, cost: 0 },
      ],
      byMealSlot: [{ mealSlot: "breakfast", cost: 45000 }],
    },
  };
}

/** What RM-07 does to the roadmap: the item joins its day, ordered by meal, and costs follow. */
function insertItem(dayId: number, body: AddRoadmapItemRequestDto) {
  const day = detail.itinerary.find((entry) => entry.dayId === dayId)!;
  const dish = catalog.find((entry) => entry.id === body.dishId)!;
  const item: RoadmapItemDto = {
    id: 5000 + body.dishId,
    dayId,
    dayNumber: day.dayNumber,
    mealSlot: body.mealSlot,
    sortOrder: body.sortOrder ?? 0,
    source: "manual",
    recoRequestId: body.recoRequestId ?? null,
    myFeedback: null,
    createdAt: "2026-10-24T02:10:00Z",
    dish: { ...dish, status: "active" },
  };
  day.items.push(item);
  day.items.sort(
    (a, b) => slotOrder.indexOf(a.mealSlot) - slotOrder.indexOf(b.mealSlot),
  );
  day.dayCost += dish.price;
  detail.overview.itemCount += 1;
  detail.overview.totalEstimatedCost += dish.price;
  detail.budget.totalEstimatedCost += dish.price;
  detail.budget.remaining =
    (detail.budget.budgetAmount ?? 0) - detail.budget.totalEstimatedCost;
  detail.budget.byDay[day.dayNumber - 1].cost += dish.price;
  const meal = detail.budget.byMealSlot.find(
    (e) => e.mealSlot === body.mealSlot,
  );
  if (meal) meal.cost += dish.price;
  else
    detail.budget.byMealSlot.push({
      mealSlot: body.mealSlot,
      cost: dish.price,
    });
  return item;
}

/** What RM-09 does: the item leaves its day, every other item stays, and costs follow. */
function deleteItem(itemId: number) {
  for (const day of detail.itinerary) {
    const index = day.items.findIndex((entry) => entry.id === itemId);
    if (index < 0) continue;
    const [item] = day.items.splice(index, 1);
    const price = item.dish.price;
    day.dayCost -= price;
    detail.overview.itemCount -= 1;
    detail.overview.totalEstimatedCost -= price;
    detail.budget.totalEstimatedCost -= price;
    detail.budget.remaining =
      (detail.budget.budgetAmount ?? 0) - detail.budget.totalEstimatedCost;
    detail.budget.byDay[day.dayNumber - 1].cost -= price;
    const meal = detail.budget.byMealSlot.find(
      (e) => e.mealSlot === item.mealSlot,
    );
    if (meal) meal.cost -= price;
    detail.budget.byMealSlot = detail.budget.byMealSlot.filter(
      (e) => e.cost > 0,
    );
    return true;
  }
  return false;
}

const roadmaps: StubHandler = ({ method, url, body }, send) => {
  const parsed = new URL(url, "http://stub");
  const path = parsed.pathname;
  if (method === "GET" && path === "/api/v1/roadmaps/88") {
    detailReads += 1;
    if (failDetailReads > 0 && detailReads > 1) {
      failDetailReads -= 1;
      send(503, null, "SERVICE_UNAVAILABLE");
    } else send(200, detail);
    return true;
  }
  const route = /^\/api\/v1\/roadmaps\/88\/days\/(\d+)\/route$/.exec(path);
  if (method === "GET" && route) {
    routeCalls.push(`${route[1]}${parsed.search}`);
    const day = detail.itinerary.find((d) => d.dayId === Number(route[1]));
    const legs = (day?.items ?? []).map((entry, index, all) => ({
      fromItemId: index === 0 ? null : all[index - 1].id,
      toItemId: entry.id,
      distanceMeters: 1000 * (index + 1),
      durationSeconds: 300 * (index + 1),
    }));
    send(200, {
      dayId: Number(route[1]),
      profile: "driving",
      origin: {
        latitude: 16.061204,
        longitude: 108.227531,
        label: "Khách sạn Sala Đà Nẵng",
        source: "pinned",
      },
      originSkipped: false,
      legs,
      totalDistanceMeters: legs.reduce((s, l) => s + l.distanceMeters, 0),
      totalDurationSeconds: legs.reduce((s, l) => s + l.durationSeconds, 0),
      isEstimated: false,
    });
    return true;
  }
  if (method === "GET" && path === "/api/v1/roadmaps/88/suggestions") {
    suggestionCalls.push(parsed.search.slice(1));
    if (failSuggestions > 0) {
      failSuggestions -= 1;
      send(503, null, "SERVICE_UNAVAILABLE");
      return true;
    }
    const query = parsed.searchParams;
    // GetRoadmapSuggestionsRequestDtoValidator.
    const limit = query.has("limit") ? Number(query.get("limit")) : 20;
    const slot = query.get("mealSlot");
    const maxPrice = query.get("maxPrice");
    if (
      !query.get("province") ||
      !(limit >= 1 && limit <= 50) ||
      (slot && !slotOrder.includes(slot as MealSlot)) ||
      (maxPrice !== null && !(Number(maxPrice) >= 0)) ||
      query.has("lat") !== query.has("lng")
    ) {
      send(400, null, "VALIDATION_FAILED", {
        Province: ["province là bắt buộc."],
      });
      return true;
    }
    const cursor = query.get("cursor");
    // The server forgot the ranked list behind this cursor (INVALID_CURSOR, once).
    if (cursor && expireNextCursor) {
      expireNextCursor = false;
      send(400, null, "INVALID_CURSOR");
      return true;
    }
    const offset = cursor ? Number(cursor.replace("c", "")) : 0;
    const inRoadmap = new Set(
      detail.itinerary.flatMap((day) =>
        day.items.map((entry) => entry.dish.id),
      ),
    );
    const text = (query.get("q") ?? "").toLowerCase();
    const ranked =
      query.get("province") !== "Thành phố Đà Nẵng"
        ? []
        : catalog.filter(
            (dish) =>
              !inRoadmap.has(dish.id) &&
              (!text ||
                `${dish.name} ${dish.restaurant.name}`
                  .toLowerCase()
                  .includes(text)) &&
              (maxPrice === null || dish.price <= Number(maxPrice)),
          );
    const page = ranked.slice(offset, offset + limit);
    send(200, {
      requestId,
      items: page,
      nextCursor: offset + limit < ranked.length ? `c${offset + limit}` : null,
    });
    return true;
  }
  const remove = /^\/api\/v1\/roadmaps\/88\/items\/(\d+)$/.exec(path);
  if (method === "DELETE" && remove) {
    deleteCalls.push(Number(remove[1]));
    if (failDelete) {
      const failure = failDelete;
      failDelete = null;
      send(failure.status, null, failure.errorCode);
      return true;
    }
    if (itemGoneElsewhere) {
      // Removed from another tab in the meantime: RM-09 answers 404 ROADMAP_ITEM_NOT_FOUND.
      itemGoneElsewhere = false;
      deleteItem(Number(remove[1]));
      send(404, null, "ROADMAP_ITEM_NOT_FOUND");
      return true;
    }
    if (!deleteItem(Number(remove[1]))) {
      send(404, null, "ROADMAP_ITEM_NOT_FOUND");
      return true;
    }
    send(200, null);
    return true;
  }
  const add = /^\/api\/v1\/roadmaps\/88\/days\/(\d+)\/items$/.exec(path);
  if (method === "POST" && add) {
    const request = body as AddRoadmapItemRequestDto;
    addCalls.push({ dayId: Number(add[1]), body: request });
    if (failAdd) {
      send(failAdd.status, null, failAdd.errorCode);
      return true;
    }
    if (
      !(request.dishId > 0) ||
      !slotOrder.includes(request.mealSlot) ||
      !catalog.some((dish) => dish.id === request.dishId)
    ) {
      send(400, null, "VALIDATION_FAILED");
      return true;
    }
    send(201, insertItem(Number(add[1]), request));
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
  suggestionCalls = [];
  addCalls = [];
  routeCalls = [];
  failSuggestions = 0;
  failAdd = null;
  failDetailReads = 0;
  detailReads = 0;
  expireNextCursor = false;
  deleteCalls = [];
  failDelete = null;
  itemGoneElsewhere = false;
  await page.route("**/api/locations/provinces", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          { name: "Thành phố Hà Nội", code: 1 },
          { name: "Thành phố Đà Nẵng", code: 48 },
        ],
      },
    }),
  );
});

const day2 = { name: "Chủ Nhật, 11 tháng 10" };
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: /^Thêm món vào / });
const targetMeal = (page: Page) =>
  dialog(page).getByLabel("Bữa", { exact: true });
const items = (page: Page) => page.locator(".roadmap-item");
const addButton = (page: Page, name: string, slot: string) =>
  dialog(page).getByRole("button", { name: `Thêm ${name} vào ${slot}` });

async function open(page: Page, path = "/roadmaps/88") {
  await loginAs(page, "traveler");
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: detail.overview.title, level: 1 }),
  ).toBeVisible();
}

test("a meal's button opens the dialog on that meal with the province already filled", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Thêm món vào bữa sáng" }).click();
  const box = dialog(page);
  await expect(
    box.getByRole("heading", { name: "Thêm món vào lộ trình" }),
  ).toBeVisible();
  // The meal is only where a picked dish goes: no meal pills filter the list.
  await expect(targetMeal(page)).toHaveValue("breakfast");
  await expect(box.getByRole("tab")).toHaveCount(0);
  // The roadmap keeps no destination: it is taken from the province of the dishes already in it.
  await expect(box.getByLabel(/^Tỉnh \/ thành phố/)).toHaveValue(
    "Thành phố Đà Nẵng",
  );
  await expect(
    box.getByRole("heading", {
      name: "Món gợi ý tại Thành phố Đà Nẵng",
      level: 3,
    }),
  ).toBeVisible();
  // The first page: documented names only, the pinned origin decides the area.
  expect(suggestionCalls).toHaveLength(1);
  const query = new URLSearchParams(suggestionCalls[0]);
  expect(Object.fromEntries(query)).toEqual({
    province: "Thành phố Đà Nẵng",
    dayId: "301",
    limit: "12",
  });
  await expect(box.locator(".roadmap-suggestion")).toHaveCount(12);
  await expect(
    box.getByText(/Ưu tiên quán trong bán kính 10 km quanh Khách sạn Sala/),
  ).toBeVisible();
  await expect(box.locator(".roadmap-suggestion").first()).toContainText(
    "Mì Quảng ếch",
  );
  await expect(box.locator(".roadmap-suggestion").first()).toContainText(
    "30.000 VND",
  );
  await expect(box.locator(".roadmap-suggestion").first()).toContainText(
    "Quán số 1 · Quận Hải Châu, Thành phố Đà Nẵng · 4,6 sao",
  );
  await expect(box.locator(".roadmap-suggestion").first()).toContainText(
    "Bữa trưa",
  );
  // The dish already in the day is not offered again.
  await expect(box.getByText("Bún bò Huế")).toHaveCount(0);
});

test("adding a dish sends RM-07, reloads the roadmap and keeps the dialog for the next one", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Thêm món vào bữa sáng" }).click();
  const box = dialog(page);
  // Choosing the target meal does not reload the list or add a filter.
  await expect(box.locator(".roadmap-suggestion")).toHaveCount(12);
  const callsBefore = suggestionCalls.length;
  await targetMeal(page).selectOption("lunch");
  await expect(box.locator(".roadmap-suggestion")).toHaveCount(12);
  expect(suggestionCalls).toHaveLength(callsBefore);

  await addButton(page, "Mì Quảng ếch", "bữa trưa").click();
  await expect(
    box.getByRole("button", { name: "Mì Quảng ếch: đã thêm vào bữa trưa" }),
  ).toHaveText("✓ Đã thêm");
  expect(addCalls).toEqual([
    {
      dayId: 301,
      body: { dishId: 200, mealSlot: "lunch", recoRequestId: requestId },
    },
  ]);
  await expect(box.getByRole("status")).toContainText(
    "Đã thêm Mì Quảng ếch vào bữa trưa của Thứ Bảy, 10 tháng 10.",
  );

  // RM-03 was read again behind the dialog: the day, its total and the budget follow the server.
  await expect(items(page)).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Bữa trưa", level: 4 }),
  ).toBeVisible();
  await expect(page.locator(".roadmap-day-sub").first()).toContainText(
    "2 món · 75.000 VND",
  );
  expect(detailReads).toBe(2);

  // Added once: pressing it again changes nothing, another dish can still be added.
  // The button stays focusable but inert (aria-disabled): a forced click must not add again.
  await box
    .getByRole("button", { name: "Mì Quảng ếch: đã thêm vào bữa trưa" })
    .click({ force: true });
  expect(addCalls).toHaveLength(1);
  await addButton(page, "Món gợi ý 2", "bữa trưa").click();
  await expect(items(page)).toHaveCount(3);
  expect(addCalls.map((call) => call.body.dishId)).toEqual([200, 201]);
  await box.getByRole("button", { name: "Xong" }).click();
  await expect(box).toBeHidden();
  await page.getByRole("tab", { name: "Ngân sách" }).click();
  await expect(
    page
      .getByRole("tabpanel", { name: "Ngân sách" })
      .locator(".roadmap-budget-total"),
  ).toContainText("110.000 VND");
});

test("the legs of a day are asked again once a dish is added to it", async ({
  page,
}) => {
  await open(page);
  // One dish and a pinned origin: day 1 already has its first leg.
  await expect.poll(() => routeCalls).toEqual(["301"]);
  await page.getByRole("button", { name: "Thêm món vào bữa sáng" }).click();
  await targetMeal(page).selectOption("lunch");
  await addButton(page, "Mì Quảng ếch", "bữa trưa").click();
  await expect(items(page)).toHaveCount(2);
  await dialog(page).getByRole("button", { name: "Xong" }).click();
  await expect.poll(() => routeCalls).toEqual(["301", "301"]);
  await expect(page.locator(".roadmap-leg")).toHaveCount(2);
});

test("an empty day opens the dialog from its own button, starting at breakfast", async ({
  page,
}) => {
  await open(page, "/roadmaps/88?day=2");
  await expect(page.getByRole("button", day2)).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(
    page.getByText(/Bấm “Thêm món” để chọn món ANGI gợi ý/),
  ).toBeVisible();
  await page
    .locator("#day-2")
    .getByRole("button", { name: "+ Thêm món", exact: true })
    .click();
  const box = dialog(page);
  await expect(
    box.getByRole("heading", { name: "Thêm món vào lộ trình" }),
  ).toBeVisible();
  await expect(targetMeal(page)).toHaveValue("breakfast");
  expect(new URLSearchParams(suggestionCalls[0]).get("dayId")).toBe("302");
  await addButton(page, "Mì Quảng ếch", "bữa sáng").click();
  await expect.poll(() => addCalls.length).toBe(1);
  expect(addCalls[0]).toMatchObject({
    dayId: 302,
    body: { dishId: 200, mealSlot: "breakfast" },
  });
  await box.getByRole("button", { name: "Xong" }).click();
  await expect(page.locator("#day-2 .roadmap-item")).toHaveCount(1);
});

test("filters are sent only when filled and the list reloads on search", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Thêm món vào bữa sáng" }).click();
  const box = dialog(page);
  await expect(box.locator(".roadmap-suggestion")).toHaveCount(12);
  await box.getByLabel("Tìm món hoặc quán").fill("  ếch ");
  const price = box.getByLabel(/^Giá tối đa mỗi món/);
  await price.pressSequentially("40000");
  await expect(price).toHaveValue("40.000 VND");
  await box.getByRole("button", { name: "Tìm món", exact: true }).click();
  await expect(box.locator(".roadmap-suggestion")).toHaveCount(1);
  expect(
    Object.fromEntries(new URLSearchParams(suggestionCalls.at(-1))),
  ).toEqual({
    province: "Thành phố Đà Nẵng",
    dayId: "301",
    q: "ếch",
    maxPrice: "40000",
    limit: "12",
  });
  await expect(box.locator(".roadmap-suggestion")).toContainText(
    "Mì Quảng ếch",
  );

  // Nothing matches in another province: an explanation, not an empty box.
  await box.getByLabel(/^Tỉnh \/ thành phố/).fill("Thành phố Hà Nội");
  await box.getByLabel("Tìm món hoặc quán").fill("");
  await price.fill("");
  await box.getByRole("button", { name: "Tìm món", exact: true }).click();
  await expect(
    box.getByRole("heading", { name: "Chưa có món phù hợp" }),
  ).toBeVisible();
  expect(
    Object.fromEntries(new URLSearchParams(suggestionCalls.at(-1))),
  ).toEqual({
    province: "Thành phố Hà Nội",
    dayId: "301",
    limit: "12",
  });
});

test("the cursor pages the list, an expired cursor offers a fresh list", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Thêm món vào bữa sáng" }).click();
  const box = dialog(page);
  await expect(box.locator(".roadmap-suggestion")).toHaveCount(12);
  await box.getByRole("button", { name: "Xem thêm món" }).click();
  await expect(box.locator(".roadmap-suggestion")).toHaveCount(24);
  const second = new URLSearchParams(suggestionCalls.at(-1));
  // A later page repeats the province (always required) and adds the cursor.
  expect(second.get("cursor")).toBe("c12");
  expect(second.get("province")).toBe("Thành phố Đà Nẵng");
  await box.getByRole("button", { name: "Xem thêm món" }).click();
  await expect(box.locator(".roadmap-suggestion")).toHaveCount(30);
  await expect(box.getByRole("button", { name: "Xem thêm món" })).toHaveCount(
    0,
  );

  // INVALID_CURSOR: the list rotted on the server, so offer to load it again.
  await box.getByRole("button", { name: "Tìm món", exact: true }).click();
  await expect(box.locator(".roadmap-suggestion")).toHaveCount(12);
  expireNextCursor = true;
  await box.getByRole("button", { name: "Xem thêm món" }).click();
  await expect(box.getByRole("alert")).toContainText(
    "Danh sách gợi ý đã hết hạn.",
  );
  await box.getByRole("button", { name: "Tải lại gợi ý" }).click();
  await expect(box.locator(".roadmap-suggestion")).toHaveCount(12);
  await expect(box.getByRole("alert")).toHaveCount(0);
});

test("a failed list can be retried; a failed add keeps the dialog and says why", async ({
  page,
}) => {
  failSuggestions = 1;
  await open(page);
  await page.getByRole("button", { name: "Thêm món vào bữa sáng" }).click();
  const box = dialog(page);
  await expect(box.locator(".alert-error")).toContainText(
    "Hiện chưa kết nối được với hệ thống.",
  );
  await box.getByRole("button", { name: "Thử lại" }).click();
  await expect(box.locator(".roadmap-suggestion")).toHaveCount(12);

  failAdd = { status: 400, errorCode: "DISH_NOT_AVAILABLE" };
  await addButton(page, "Mì Quảng ếch", "bữa sáng").click();
  const first = box.locator(".roadmap-suggestion").first();
  await expect(first).toContainText("Món này không còn khả dụng");
  await expect(first).toContainText("Món không còn khả dụng");
  await expect(
    box.getByRole("button", { name: "Thêm Mì Quảng ếch vào bữa sáng" }),
  ).toHaveAttribute("aria-disabled", "true");
  // Nothing was added to the roadmap and the other dishes are still available.
  await expect(items(page)).toHaveCount(1);
  expect(detailReads).toBe(1);
  failAdd = null;
  await addButton(page, "Món gợi ý 2", "bữa sáng").click();
  await expect(items(page)).toHaveCount(2);
});

test("a dish added while the roadmap cannot be reloaded is reported", async ({
  page,
}) => {
  await open(page);
  failDetailReads = 1;
  await page.getByRole("button", { name: "Thêm món vào bữa sáng" }).click();
  const box = dialog(page);
  await addButton(page, "Mì Quảng ếch", "bữa sáng").click();
  await expect(
    box.getByRole("button", { name: "Mì Quảng ếch: đã thêm vào bữa sáng" }),
  ).toBeVisible();
  await expect(box.getByText(/chưa tải lại được lộ trình/)).toBeVisible();
  expect(addCalls).toHaveLength(1);
});

test("without a known province nothing is asked until one is chosen", async ({
  page,
}) => {
  for (const day of detail.itinerary) day.items = [];
  detail.overview.itemCount = 0;
  detail.overview.title = "Cuối tuần của tôi";
  await open(page);
  await page
    .locator("#day-1")
    .getByRole("button", { name: "+ Thêm món", exact: true })
    .click();
  const box = dialog(page);
  await expect(box.getByLabel(/^Tỉnh \/ thành phố/)).toBeFocused();
  await expect(box.getByText(/Chọn tỉnh \/ thành phố bạn sẽ ăn/)).toBeVisible();
  expect(suggestionCalls).toEqual([]);
  await box.getByRole("button", { name: "Tìm món", exact: true }).click();
  await expect(
    box.getByText("Chọn tỉnh / thành phố bạn muốn tìm món."),
  ).toBeVisible();
  expect(suggestionCalls).toEqual([]);
  await box.getByLabel(/^Tỉnh \/ thành phố/).fill("Thành phố Đà Nẵng");
  await box.getByRole("button", { name: "Tìm món", exact: true }).click();
  await expect(box.locator(".roadmap-suggestion")).toHaveCount(12);
  expect(suggestionCalls).toHaveLength(1);
  // The choice is remembered for this roadmap, so the next dialog opens with it.
  await box.getByRole("button", { name: "Xong" }).click();
  await page
    .locator("#day-1")
    .getByRole("button", { name: "+ Thêm món", exact: true })
    .click();
  await expect(dialog(page).getByLabel(/^Tỉnh \/ thành phố/)).toHaveValue(
    "Thành phố Đà Nẵng",
  );
  await expect(dialog(page).locator(".roadmap-suggestion")).toHaveCount(12);
});

test("the province defaults to the one named by the roadmap's title", async ({
  page,
}) => {
  for (const day of detail.itinerary) day.items = [];
  detail.overview.itemCount = 0;
  detail.overview.title = "Đi chơi Hà Nội";
  await open(page);
  await page
    .locator("#day-1")
    .getByRole("button", { name: "+ Thêm món", exact: true })
    .click();
  const box = dialog(page);
  await expect(box.getByLabel(/^Tỉnh \/ thành phố/)).toHaveValue(
    "Thành phố Hà Nội",
  );
  // The list is asked for at once with that province, nothing had to be typed.
  await expect(
    box.getByRole("heading", { name: "Chưa có món phù hợp" }),
  ).toBeVisible();
  expect(suggestionCalls).toHaveLength(1);
  expect(new URLSearchParams(suggestionCalls[0]).get("province")).toBe(
    "Thành phố Hà Nội",
  );

  // Typing another province wins over the title.
  await box.getByLabel(/^Tỉnh \/ thành phố/).fill("Thành phố Đà Nẵng");
  await box.getByRole("button", { name: "Tìm món", exact: true }).click();
  await expect(box.locator(".roadmap-suggestion")).toHaveCount(12);
});

test("the position the traveler allowed is sent as a pair for a gps roadmap", async ({
  page,
  context,
}) => {
  detail.overview.originMode = "gps";
  detail.overview.originLatitude = null;
  detail.overview.originLongitude = null;
  detail.overview.originLabel = null;
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 16.0678, longitude: 108.2208 });
  await open(page);
  // Before the position is allowed there is no area and the dialog says how to get one.
  await page.getByRole("button", { name: "Thêm món vào bữa sáng" }).click();
  await expect(
    dialog(page).getByText(/hãy cho phép vị trí ở phần Lịch trình/),
  ).toBeVisible();
  expect(new URLSearchParams(suggestionCalls[0]).has("lat")).toBe(false);
  await dialog(page).getByRole("button", { name: "Xong" }).click();

  await page.getByRole("button", { name: "Tính từ vị trí hiện tại" }).click();
  await expect(page.getByText(/Tọa độ không được lưu/)).toBeVisible();
  await page.getByRole("button", { name: "Thêm món vào bữa sáng" }).click();
  await expect(
    dialog(page).getByText(/quanh vị trí hiện tại của bạn/),
  ).toBeVisible();
  await expect
    .poll(() => new URLSearchParams(suggestionCalls.at(-1)).get("lat"))
    .toBe("16.0678");
  expect(new URLSearchParams(suggestionCalls.at(-1)).get("lng")).toBe(
    "108.2208",
  );
});

test("the dialog works with the keyboard and has no horizontal overflow from 320px to 1440px", async ({
  page,
}) => {
  await open(page);
  const opener = page.getByRole("button", { name: "Thêm món vào bữa sáng" });
  await opener.focus();
  await page.keyboard.press("Enter");
  const box = dialog(page);
  await expect(box.locator(".roadmap-suggestion")).toHaveCount(12);
  await page.keyboard.press("Escape");
  await expect(box).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(box.locator(".roadmap-suggestion")).toHaveCount(12);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await box.evaluate(
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

// F-28 Delete Roadmap Item (RM-09).
const removeButton = (page: Page, dish: string) =>
  page.getByRole("button", { name: `Xóa ${dish} khỏi lộ trình` });
const confirmDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Xóa món khỏi lộ trình?" });
const confirmRemove = (page: Page) =>
  confirmDialog(page).getByRole("button", { name: "Xóa món", exact: true });
/** Day 1 with breakfast (Bún bò Huế, 45.000) and lunch (Mì Quảng ếch, 30.000). */
function withLunch() {
  insertItem(301, {
    dishId: 200,
    mealSlot: "lunch",
    recoRequestId: requestId,
  });
}

test("removing a dish asks first, sends RM-09 and leaves the other dishes alone", async ({
  page,
}) => {
  withLunch();
  await open(page);
  await expect(items(page)).toHaveCount(2);
  await expect(page.locator(".roadmap-day-sub").first()).toContainText(
    "2 món · 75.000 VND",
  );
  // The dish picked on the map is the one removed: the selection must not outlive it.
  const locate = page
    .locator(".roadmap-item")
    .getByRole("button", { name: "Xem vị trí Bún bò Huế" });
  await locate.click();
  await expect(locate).toHaveAttribute("aria-pressed", "true");

  await removeButton(page, "Bún bò Huế").click();
  const box = confirmDialog(page);
  await expect(box).toContainText(
    "Bún bò Huế (Bún Bò Bà Diệu) sẽ bị xóa khỏi bữa sáng của Thứ Bảy, 10 tháng 10.",
  );
  await expect(box).toContainText(
    "Các món khác trong lộ trình không bị ảnh hưởng",
  );
  // Nothing is sent until the traveler confirms.
  expect(deleteCalls).toEqual([]);
  await confirmRemove(page).click();
  await expect(box).toBeHidden();

  expect(deleteCalls).toEqual([1502]);
  // RM-03 is read again: figures, order and budget are the backend's.
  await expect(items(page)).toHaveCount(1);
  await expect(
    page.locator(".roadmap-item", { hasText: "Mì Quảng ếch" }),
  ).toBeVisible();
  await expect(
    page.locator(".roadmap-item", { hasText: "Bún bò Huế" }),
  ).toHaveCount(0);
  await expect(page.locator(".roadmap-day-sub").first()).toContainText(
    "1 món · 30.000 VND",
  );
  expect(detailReads).toBe(2);
  await expect(page.locator(".roadmap-day-notice")).toContainText(
    "Đã xóa Bún bò Huế khỏi lộ trình.",
  );
  // The card that held the focus is gone, so the notice takes it.
  await expect(page.locator(".roadmap-day-notice")).toBeFocused();
  // It is only a confirmation: after 5 seconds it goes away by itself.
  await expect(page.locator(".roadmap-day-notice")).toBeHidden({
    timeout: 8000,
  });
  await page.getByRole("tab", { name: "Ngân sách" }).click();
  await expect(
    page
      .getByRole("tabpanel", { name: "Ngân sách" })
      .locator(".roadmap-budget-total"),
  ).toContainText("30.000 VND");
});

test("keeping the dish or pressing Escape sends nothing and returns the focus", async ({
  page,
}) => {
  await open(page);
  const opener = removeButton(page, "Bún bò Huế");
  await opener.click();
  await confirmDialog(page).getByRole("button", { name: "Giữ món" }).click();
  await expect(confirmDialog(page)).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await page.keyboard.press("Escape");
  await expect(confirmDialog(page)).toBeHidden();
  await expect(opener).toBeFocused();
  expect(deleteCalls).toEqual([]);
  await expect(items(page)).toHaveCount(1);
});

test("a failed removal keeps the dish and the dialog, and can be tried again", async ({
  page,
}) => {
  await open(page);
  failDelete = { status: 503, errorCode: "SERVICE_UNAVAILABLE" };
  await removeButton(page, "Bún bò Huế").click();
  const box = confirmDialog(page);
  await confirmRemove(page).click();
  await expect(box.getByRole("alert")).toContainText(
    "Hiện chưa kết nối được với hệ thống.",
  );
  await expect(items(page)).toHaveCount(1);
  expect(detailReads).toBe(1);
  await confirmRemove(page).click();
  await expect(box).toBeHidden();
  expect(deleteCalls).toEqual([1502, 1502]);
  await expect(items(page)).toHaveCount(0);
  await expect(page.locator(".roadmap-day-sub").first()).toContainText(
    "Chưa có món",
  );
});

test("a dish already removed elsewhere is reported and the list is refreshed", async ({
  page,
}) => {
  withLunch();
  await open(page);
  itemGoneElsewhere = true;
  await removeButton(page, "Bún bò Huế").click();
  await confirmRemove(page).click();
  await expect(confirmDialog(page)).toBeHidden();
  await expect(page.locator(".roadmap-day-notice")).toContainText(
    "Bún bò Huế không còn trong lộ trình",
  );
  await expect(items(page)).toHaveCount(1);
  expect(deleteCalls).toEqual([1502]);
});

test("a removal whose reload fails says the roadmap may be out of date", async ({
  page,
}) => {
  await open(page);
  failDetailReads = 1;
  await removeButton(page, "Bún bò Huế").click();
  await confirmRemove(page).click();
  await expect(confirmDialog(page)).toBeHidden();
  await expect(page.locator(".roadmap-day-notice")).toContainText(
    "Món đã được xóa nhưng chưa tải lại được lộ trình",
  );
  // A warning is not a confirmation: it stays past the 5 seconds of a success notice.
  await page.waitForTimeout(5500);
  await expect(page.locator(".roadmap-day-notice")).toBeVisible();
  expect(deleteCalls).toEqual([1502]);
});

test("the legs of a day are asked again once a dish is removed from it", async ({
  page,
}) => {
  withLunch();
  await open(page);
  await expect.poll(() => routeCalls).toEqual(["301"]);
  await removeButton(page, "Bún bò Huế").click();
  await confirmRemove(page).click();
  await expect(items(page)).toHaveCount(1);
  await expect.poll(() => routeCalls).toEqual(["301", "301"]);
});

test("the remove action and its dialog fit from 320px to 1440px", async ({
  page,
}) => {
  await open(page);
  await removeButton(page, "Bún bò Huế").click();
  const box = confirmDialog(page);
  await expect(box).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await box.evaluate(
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
