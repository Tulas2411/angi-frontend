import { expect, test, type Page } from "@playwright/test";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";
import type {
  GenerateRoadmapRequestDto,
  MealSlot,
  RoadmapDetailDto,
  RoadmapItemDto,
} from "../../src/features/roadmaps/roadmap-types";

/**
 * F-26: RM-10 and RM-11 against a local stub shaped like the API Design JSON samples. The stub
 * runs the job the way the backend does: queued, then running, then finished, one step per read.
 */
const slotOrder: MealSlot[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "late_night",
];
const tags = [
  { id: 1, tagType: "meal_time", code: "breakfast", name: "Bữa sáng" },
  { id: 4, tagType: "category", code: "soup", name: "Món nước" },
  { id: 5, tagType: "category", code: "dry", name: "Món khô" },
  { id: 6, tagType: "dietary", code: "vegetarian", name: "Món chay" },
];

type Outcome = "succeed" | "fail";
interface Job {
  id: number;
  scope: string;
  reads: number;
  outcome: Outcome;
  createdItemIds: number[];
}

let detail: RoadmapDetailDto;
let generateCalls: GenerateRoadmapRequestDto[] = [];
let jobReads: number[] = [];
let jobs = new Map<number, Job>();
let nextJobId = 77;
let nextOutcome: Outcome = "succeed";
let failGenerate: { status: number; errorCode: string } | null = null;
let failJobReads = 0;
let failTags = false;
let nextItemId = 1600;

const restaurant = {
  id: 7,
  name: "Bún Bò Bà Diệu",
  district: "Quận Hoàn Kiếm",
  provinceName: "Thành phố Hà Nội",
  latitude: 21.0285,
  longitude: 105.8542,
  ratingAvg: 4.6,
};

function item(
  id: number,
  dayId: number,
  dayNumber: number,
  mealSlot: MealSlot,
  name: string,
  source: "manual" | "ai",
): RoadmapItemDto {
  return {
    id,
    dayId,
    dayNumber,
    mealSlot,
    sortOrder: 0,
    source,
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
  };
}

function baseDetail(): RoadmapDetailDto {
  const day = (dayId: number, dayNumber: number, items: RoadmapItemDto[]) => ({
    dayId,
    dayNumber,
    date: `2026-10-${9 + dayNumber}`,
    note: null,
    dayCost: items.length * 45000,
    items,
  });
  return {
    overview: {
      id: 88,
      title: "Đi chơi Hà Nội",
      startDate: "2026-10-10",
      endDate: "2026-10-12",
      numDays: 3,
      budgetAmount: 1500000,
      totalEstimatedCost: 45000,
      itemCount: 1,
      coverUrl: null,
      originMode: "none",
      originLatitude: null,
      originLongitude: null,
      originLabel: null,
      createdAt: "2026-10-25T02:00:00Z",
      updatedAt: "2026-10-25T03:00:00Z",
    },
    itinerary: [
      day(301, 1, [item(1502, 301, 1, "breakfast", "Bún bò Huế", "manual")]),
      day(302, 2, []),
      day(303, 3, []),
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

/** What the worker writes: one dish per meal, empty meals only unless `replaceExisting`. */
function writeItems(body: GenerateRoadmapRequestDto) {
  const slots =
    body.scope === "slot"
      ? [body.mealSlot!]
      : (body.mealSlots ?? slotOrder.slice(0, 3));
  const days = detail.itinerary.filter(
    (day) => body.scope === "full" || day.dayId === body.dayId,
  );
  const created: number[] = [];
  for (const day of days)
    for (const slot of slots) {
      const taken = day.items.some((entry) => entry.mealSlot === slot);
      if (taken && !body.replaceExisting) continue;
      day.items = day.items.filter((entry) => entry.mealSlot !== slot);
      nextItemId += 1;
      day.items.push(
        item(
          nextItemId,
          day.dayId,
          day.dayNumber,
          slot,
          `Món AI ${nextItemId}`,
          "ai",
        ),
      );
      created.push(nextItemId);
    }
  for (const day of detail.itinerary) {
    day.items.sort(
      (a, b) => slotOrder.indexOf(a.mealSlot) - slotOrder.indexOf(b.mealSlot),
    );
    day.dayCost = day.items.length * 45000;
  }
  const count = detail.itinerary.reduce(
    (sum, day) => sum + day.items.length,
    0,
  );
  detail.overview.itemCount = count;
  detail.overview.totalEstimatedCost = count * 45000;
  detail.budget.totalEstimatedCost = count * 45000;
  detail.budget.remaining = 1500000 - count * 45000;
  return created;
}

const roadmaps: StubHandler = ({ method, url, body }, send) => {
  const path = new URL(url, "http://stub").pathname;
  if (method === "GET" && path === "/api/v1/tags") {
    if (failTags) send(503, null, "SERVICE_UNAVAILABLE");
    else send(200, tags);
    return true;
  }
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
  if (method === "POST" && path === "/api/v1/roadmaps/88/generate") {
    const request = body as GenerateRoadmapRequestDto;
    generateCalls.push(request);
    if (failGenerate) {
      const failure = failGenerate;
      failGenerate = null;
      send(failure.status, null, failure.errorCode);
      return true;
    }
    const running = [...jobs.values()].some((job) => job.reads < 3);
    if (running) {
      send(409, null, "GENERATION_IN_PROGRESS");
      return true;
    }
    const id = nextJobId++;
    jobs.set(id, {
      id,
      scope: request.scope,
      reads: 0,
      outcome: nextOutcome,
      createdItemIds: [],
    });
    send(202, { jobId: id, status: "queued" });
    return true;
  }
  const read = /^\/api\/v1\/roadmaps\/88\/generation-jobs\/(\d+)$/.exec(path);
  if (method === "GET" && read) {
    const id = Number(read[1]);
    jobReads.push(id);
    const job = jobs.get(id);
    if (!job) {
      send(404, null, "JOB_NOT_FOUND");
      return true;
    }
    if (failJobReads > 0) {
      failJobReads -= 1;
      send(503, null, "SERVICE_UNAVAILABLE");
      return true;
    }
    job.reads += 1;
    const status =
      job.reads === 1 ? "queued" : job.reads === 2 ? "running" : null;
    if (status) {
      send(200, {
        jobId: id,
        scope: job.scope,
        status,
        errorMessage: null,
        createdItemIds: [],
        createdAt: "2026-10-25T02:20:00Z",
        finishedAt: null,
      });
      return true;
    }
    if (job.outcome === "fail") {
      send(200, {
        jobId: id,
        scope: job.scope,
        status: "failed",
        errorMessage: "Không tìm thấy món phù hợp với các điều kiện đã chọn.",
        createdItemIds: [],
        createdAt: "2026-10-25T02:20:00Z",
        finishedAt: "2026-10-25T02:20:04Z",
      });
      return true;
    }
    if (!job.createdItemIds.length)
      job.createdItemIds = writeItems(generateCalls[generateCalls.length - 1]);
    send(200, {
      jobId: id,
      scope: job.scope,
      status: "succeeded",
      errorMessage: null,
      createdItemIds: job.createdItemIds,
      createdAt: "2026-10-25T02:20:00Z",
      finishedAt: "2026-10-25T02:20:04Z",
    });
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
  generateCalls = [];
  jobReads = [];
  jobs = new Map();
  nextJobId = 77;
  nextOutcome = "succeed";
  failGenerate = null;
  failJobReads = 0;
  failTags = false;
  nextItemId = 1600;
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

const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "ANGI lên lịch giúp bạn" });
const items = (page: Page) => page.locator(".roadmap-item");
const submitButton = (page: Page) =>
  dialog(page).getByRole("button", { name: "Tạo lịch bằng AI" });
const openBanner = (page: Page) =>
  page.getByRole("button", { name: "Tạo lộ trình bằng AI" }).click();

async function open(page: Page, path = "/roadmaps/88") {
  await loginAs(page, "traveler");
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: detail.overview.title, level: 1 }),
  ).toBeVisible();
}

test("the banner opens the dialog for the whole roadmap with the province from its title", async ({
  page,
}) => {
  await open(page);
  await openBanner(page);
  const box = dialog(page);
  await expect(box.getByRole("tab", { name: "Cả lộ trình" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  // The roadmap keeps no destination: "Đi chơi Hà Nội" names it.
  await expect(box.getByLabel(/^Tỉnh \/ thành phố/)).toHaveValue(
    "Thành phố Hà Nội",
  );
  for (const meal of ["Bữa sáng", "Bữa trưa", "Bữa tối"])
    await expect(box.getByRole("checkbox", { name: meal })).toBeChecked();
  for (const meal of ["Ăn vặt", "Ăn khuya"])
    await expect(box.getByRole("checkbox", { name: meal })).not.toBeChecked();
  await expect(box.getByText(/chưa có điểm xuất phát/)).toBeVisible();
  // Nothing is replaced by default.
  await expect(
    box.getByRole("checkbox", { name: "Thay các món đã có trong phạm vi" }),
  ).not.toBeChecked();
  expect(generateCalls).toEqual([]);
});

test("generating sends RM-10, follows RM-11 to the end and reloads the roadmap", async ({
  page,
}) => {
  await open(page);
  await expect(items(page)).toHaveCount(1);
  await openBanner(page);
  const box = dialog(page);
  await submitButton(page).click();

  // 202 Accepted: the job is queued, then running, then done (one RM-11 read each).
  await expect(box.getByRole("status")).toContainText("Đang xếp hàng");
  expect(generateCalls).toEqual([
    {
      scope: "full",
      province: "Thành phố Hà Nội",
      mealSlots: ["breakfast", "lunch", "dinner"],
    },
  ]);
  await expect(box.getByRole("status")).toContainText("đang chọn món");
  await expect(box.getByText(/ANGI đã thêm 8 món vào lộ trình/)).toBeVisible();
  expect(jobReads).toEqual([77, 77, 77]);

  // The breakfast of day 1 was already there; every other meal got a dish.
  await box.getByRole("button", { name: "Xem lộ trình" }).click();
  await expect(box).toBeHidden();
  await expect(items(page)).toHaveCount(3);
  await expect(page.locator(".roadmap-day-sub").first()).toContainText("3 món");
  await expect(page.getByText("ANGI gợi ý").first()).toBeVisible();
  await expect(
    page.locator(".roadmap-item", { hasText: "Bún bò Huế" }),
  ).toHaveCount(1);
});

test("one day or one meal sends its ids, the constraints and the tags as documented", async ({
  page,
}) => {
  detail.overview.originMode = "pinned";
  detail.overview.originLatitude = 21.0285;
  detail.overview.originLongitude = 105.8542;
  detail.overview.originLabel = "Khách sạn Sala Hà Nội";
  await open(page);
  await page
    .locator("#day-1")
    .getByRole("button", { name: "Gợi ý bằng AI" })
    .click();
  const box = dialog(page);
  await expect(box.getByRole("tab", { name: "Một ngày" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(box.getByLabel("Ngày")).toHaveValue("301");
  await expect(
    box.getByText(/ANGI ưu tiên quán quanh Khách sạn Sala Hà Nội/),
  ).toBeVisible();

  await box.getByRole("checkbox", { name: "Ăn vặt" }).check();
  await box.getByRole("checkbox", { name: "Bữa trưa" }).uncheck();
  const price = box.getByLabel(/^Giá tối đa mỗi món/);
  await price.pressSequentially("80000");
  await expect(price).toHaveValue("80.000 VND");
  await box.getByLabel("Ghi chú cho ANGI").fill("  Ưu tiên món nước ");
  await box.getByText("Tùy chọn thêm").click();
  await box.getByLabel(/^Bán kính quanh điểm xuất phát/).fill("5");
  await box
    .getByRole("group", { name: "Ưu tiên các loại món này" })
    .getByRole("button", { name: "Món nước" })
    .click();
  await box
    .getByRole("group", { name: "Không ăn các loại món này" })
    .getByRole("button", { name: "Món chay" })
    .click();
  // Meal-time tags repeat the meals above, so they are not offered as preferences.
  await expect(box.getByRole("button", { name: "Bữa sáng" })).toHaveCount(0);
  await submitButton(page).click();
  await expect(box.getByRole("status")).toBeVisible();
  expect(generateCalls).toEqual([
    {
      scope: "day",
      dayId: 301,
      province: "Thành phố Hà Nội",
      mealSlots: ["breakfast", "dinner", "snack"],
      maxPricePerMeal: 80000,
      tagIds: [4],
      excludeTagIds: [6],
      note: "Ưu tiên món nước",
      radiusKm: 5,
    },
  ]);
  await expect(box.getByText(/ANGI đã thêm 2 món/)).toBeVisible();
  await box.getByRole("button", { name: "Xem lộ trình" }).click();

  // One meal of one day: mealSlot replaces mealSlots.
  await page
    .locator("#day-1")
    .getByRole("button", { name: "Gợi ý bằng AI" })
    .click();
  await box.getByRole("tab", { name: "Một bữa" }).click();
  await box.getByLabel("Bữa", { exact: true }).selectOption("late_night");
  await expect(box.getByText("Các bữa ANGI cần tạo")).toHaveCount(0);
  await submitButton(page).click();
  await expect.poll(() => generateCalls.length).toBe(2);
  expect(generateCalls[1]).toEqual({
    scope: "slot",
    dayId: 301,
    mealSlot: "late_night",
    province: "Thành phố Hà Nội",
    radiusKm: 10,
  });
});

test("an empty province or no meal is explained and nothing is sent", async ({
  page,
}) => {
  await open(page);
  await openBanner(page);
  const box = dialog(page);
  await box.getByLabel(/^Tỉnh \/ thành phố/).fill("");
  for (const meal of ["Bữa sáng", "Bữa trưa", "Bữa tối"])
    await box.getByRole("checkbox", { name: meal }).uncheck();
  await submitButton(page).click();
  await expect(
    box.getByText("Chọn tỉnh / thành phố bạn muốn ANGI lấy món."),
  ).toBeVisible();
  await expect(
    box.getByText("Chọn ít nhất một bữa để ANGI tạo."),
  ).toBeVisible();
  expect(generateCalls).toEqual([]);
});

test("replacing says how many dishes go and sends replaceExisting", async ({
  page,
}) => {
  await open(page);
  await page
    .locator("#day-1")
    .getByRole("button", { name: "Gợi ý bằng AI" })
    .click();
  const box = dialog(page);
  await box
    .getByRole("checkbox", { name: "Thay các món đã có trong phạm vi" })
    .check();
  await expect(
    box.getByText(/ANGI sẽ xóa 1 món đang có của .* ở các bữa đã chọn/),
  ).toBeVisible();
  await expect(
    box.getByRole("button", { name: "Xóa món cũ và tạo lại" }),
  ).toBeVisible();
  await box.getByRole("button", { name: "Xóa món cũ và tạo lại" }).click();
  await expect.poll(() => generateCalls.length).toBe(1);
  expect(generateCalls[0]).toMatchObject({
    scope: "day",
    dayId: 301,
    replaceExisting: true,
  });
  await expect(box.getByText(/ANGI đã thêm 3 món/)).toBeVisible();
  await box.getByRole("button", { name: "Xem lộ trình" }).click();
  // The manual breakfast was replaced by a dish of ANGI's.
  await expect(
    page.locator(".roadmap-item", { hasText: "Bún bò Huế" }),
  ).toHaveCount(0);
  await expect(page.locator("#day-1 .roadmap-item")).toHaveCount(3);
});

test("a failed job shows the backend's message and keeps the conditions", async ({
  page,
}) => {
  nextOutcome = "fail";
  await open(page);
  await openBanner(page);
  const box = dialog(page);
  await box.getByLabel("Ghi chú cho ANGI").fill("Chỉ món lạ");
  await submitButton(page).click();
  await expect(box.getByRole("alert")).toContainText(
    "Không tìm thấy món phù hợp với các điều kiện đã chọn.",
    { timeout: 15000 },
  );
  expect(jobReads).toEqual([77, 77, 77]);
  await box.getByRole("button", { name: "Chỉnh điều kiện" }).click();
  await expect(box.getByLabel("Ghi chú cho ANGI")).toHaveValue("Chỉ món lạ");
  await expect(box.getByLabel(/^Tỉnh \/ thành phố/)).toHaveValue(
    "Thành phố Hà Nội",
  );
  // Nothing was added.
  await box.getByRole("button", { name: "Hủy" }).click();
  await expect(items(page)).toHaveCount(1);
});

test("closing keeps the job running and reopening follows it; a second job is refused", async ({
  page,
}) => {
  await open(page);
  await openBanner(page);
  await submitButton(page).click();
  await expect(dialog(page).getByRole("status")).toContainText("Đang xếp hàng");
  await dialog(page)
    .getByRole("button", { name: "Đóng, ANGI vẫn tạo ở nền" })
    .click();
  await expect(dialog(page)).toBeHidden();
  const readsAtClose = jobReads.length;
  await openBanner(page);
  // The remembered job is followed again: no second RM-10 call.
  await expect(dialog(page).getByRole("status")).toBeVisible();
  expect(generateCalls).toHaveLength(1);
  await expect(dialog(page).getByText(/ANGI đã thêm/)).toBeVisible({
    timeout: 15000,
  });
  expect(jobReads.length).toBeGreaterThan(readsAtClose);
  expect(new Set(jobReads)).toEqual(new Set([77]));
});

test("a running job refuses a second one with its own message", async ({
  page,
}) => {
  await open(page);
  failGenerate = { status: 409, errorCode: "GENERATION_IN_PROGRESS" };
  await openBanner(page);
  await submitButton(page).click();
  await expect(dialog(page).getByRole("alert")).toContainText(
    "Lộ trình này đang được ANGI tạo",
  );
  // The form stays: nothing started, nothing to follow.
  await expect(submitButton(page)).toBeVisible();
  await expect(
    dialog(page).getByRole("button", { name: "Xem tiến trình" }),
  ).toHaveCount(0);
});

test("a rejected request says why and keeps the form", async ({ page }) => {
  await open(page);
  failGenerate = { status: 404, errorCode: "DAY_NOT_FOUND" };
  await page
    .locator("#day-1")
    .getByRole("button", { name: "Gợi ý bằng AI" })
    .click();
  await submitButton(page).click();
  await expect(dialog(page).getByRole("alert")).toContainText(
    "Không tìm thấy ngày này trong lộ trình",
  );
  await expect(submitButton(page)).toBeVisible();
});

test("when the job cannot be read the dialog says so and can look again", async ({
  page,
}) => {
  failJobReads = 3;
  await open(page);
  await openBanner(page);
  await submitButton(page).click();
  await expect(dialog(page).getByRole("status")).toContainText(
    "Chưa kiểm tra được tiến trình",
    { timeout: 15000 },
  );
  await expect(dialog(page).getByRole("status")).toContainText(
    "ANGI vẫn tiếp tục tạo ở nền",
  );
  await dialog(page).getByRole("button", { name: "Kiểm tra lại" }).click();
  await expect(dialog(page).getByText(/ANGI đã thêm/)).toBeVisible({
    timeout: 15000,
  });
});

test("without the tag catalog the form still works", async ({ page }) => {
  failTags = true;
  await open(page);
  await openBanner(page);
  const box = dialog(page);
  await box.getByText("Tùy chọn thêm").click();
  await expect(
    box.getByRole("group", { name: "Ưu tiên các loại món này" }),
  ).toHaveCount(0);
  await submitButton(page).click();
  await expect.poll(() => generateCalls.length).toBe(1);
});

test("the dialog works with the keyboard and fits from 320px to 1440px", async ({
  page,
}) => {
  await open(page);
  const opener = page.getByRole("button", { name: "Tạo lộ trình bằng AI" });
  await opener.focus();
  await page.keyboard.press("Enter");
  const box = dialog(page);
  await expect(box.getByRole("tab", { name: "Cả lộ trình" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(box).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await box.getByText("Tùy chọn thêm").click();
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
