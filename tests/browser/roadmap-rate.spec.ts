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
  RateRoadmapItemRequestDto,
  RoadmapDetailDto,
  RoadmapItemDto,
} from "../../src/features/roadmaps/roadmap-types";

/**
 * F-30: rating a dish with RM-13 against a local stub shaped like the API Design JSON samples.
 * Like the backend, a dish of the roadmap is rated once: a second rating answers
 * 409 FEEDBACK_ALREADY_EXISTS and RM-03 returns `myFeedback` and the dish counters.
 */
let detail: RoadmapDetailDto;
let rateCalls: { itemId: number; body: RateRoadmapItemRequestDto }[] = [];
let detailReads = 0;
let failRate: { status: number; errorCode: string } | null = null;
let failDetailReads = 0;
let nextFeedbackId = 2200;

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
  name: string,
  likeCount: number,
  dislikeCount: number,
  myFeedback: "like" | "dislike" | null = null,
): RoadmapItemDto => ({
  id,
  dayId: 301,
  dayNumber: 1,
  mealSlot,
  sortOrder: 0,
  source: "manual",
  recoRequestId: null,
  myFeedback,
  createdAt: "2026-10-25T02:10:00Z",
  dish: {
    id: id + 100,
    name,
    price: 45000,
    coverUrl: null,
    dishForm: "soup",
    isAvailable: true,
    likeCount,
    dislikeCount,
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
          item(1501, "breakfast", "Phở bò", 128, 9),
          item(1502, "lunch", "Bún chả", 77, 3),
          item(1503, "dinner", "Lẩu bò", 40, 12, "like"),
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

const roadmaps: StubHandler = ({ method, url, body }, send) => {
  const path = new URL(url, "http://stub").pathname;
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
  const rate = /^\/api\/v1\/roadmaps\/88\/items\/(\d+)\/feedback$/.exec(path);
  if (method === "POST" && rate) {
    const itemId = Number(rate[1]);
    const request = body as RateRoadmapItemRequestDto;
    rateCalls.push({ itemId, body: request });
    if (failRate) {
      const failure = failRate;
      failRate = null;
      send(failure.status, null, failure.errorCode);
      return true;
    }
    const target = detail.itinerary[0].items.find(
      (entry) => entry.id === itemId,
    );
    if (!target) {
      send(404, null, "ROADMAP_ITEM_NOT_FOUND");
      return true;
    }
    if (target.myFeedback) {
      send(409, null, "FEEDBACK_ALREADY_EXISTS");
      return true;
    }
    if (request.value !== "like" && request.value !== "dislike") {
      send(400, null, "VALIDATION_FAILED");
      return true;
    }
    target.myFeedback = request.value;
    if (request.value === "like") target.dish.likeCount += 1;
    else target.dish.dislikeCount += 1;
    nextFeedbackId += 1;
    send(201, {
      feedbackId: nextFeedbackId,
      value: request.value,
      dishId: target.dish.id,
      likeCount: target.dish.likeCount,
      dislikeCount: target.dish.dislikeCount,
      createdAt: "2026-10-26T02:00:00Z",
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
  rateCalls = [];
  detailReads = 0;
  failRate = null;
  failDetailReads = 0;
  nextFeedbackId = 2200;
  await page.setViewportSize({ width: 1440, height: 1800 });
});

const card = (page: Page, dish: string) =>
  page.locator("#day-1 .roadmap-item").filter({
    has: page.getByRole("heading", { name: dish, exact: true, level: 5 }),
  });
const likeButton = (page: Page, dish: string) =>
  card(page, dish).locator('.roadmap-rate-button[data-value="like"]');
const dislikeButton = (page: Page, dish: string) =>
  card(page, dish).locator('.roadmap-rate-button[data-value="dislike"]');

async function open(page: Page) {
  await loginAs(page, "traveler");
  await page.goto("/roadmaps/88");
  await expect(
    page.getByRole("heading", { name: "Đi chơi Hà Nội", level: 1 }),
  ).toBeVisible();
  await expect(page.locator("#day-1 .roadmap-item")).toHaveCount(3);
}

test("each dish has a like and a dislike button at the bottom right without any totals", async ({
  page,
}) => {
  await open(page);
  const text = (await card(page, "Phở bò")
    .locator(".roadmap-item-text")
    .boundingBox())!;
  const like = (await likeButton(page, "Phở bò").boundingBox())!;
  const dislike = (await dislikeButton(page, "Phở bò").boundingBox())!;
  // Bottom right of the card, like before dislike, both inside it.
  expect(like.x).toBeLessThan(dislike.x);
  expect(text.x + text.width - (dislike.x + dislike.width)).toBeLessThan(40);
  expect(text.y + text.height - (dislike.y + dislike.height)).toBeLessThan(40);
  await expect(likeButton(page, "Phở bò")).toHaveAccessibleName("Thích Phở bò");
  await expect(dislikeButton(page, "Phở bò")).toHaveAccessibleName(
    "Không thích Phở bò",
  );
  // Only the traveler's own choice is shown: no like or dislike totals anywhere on the card.
  await expect(likeButton(page, "Phở bò")).toHaveText("Thích");
  await expect(dislikeButton(page, "Phở bò")).toHaveText("Không thích");
  await expect(card(page, "Phở bò")).not.toContainText(/(128|9)/);
  await expect(likeButton(page, "Phở bò")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  // A dish the traveler already liked shows it and cannot be rated again.
  await expect(likeButton(page, "Lẩu bò")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(likeButton(page, "Lẩu bò")).toHaveAccessibleName(
    "Bạn đã thích Lẩu bò",
  );
  await expect(dislikeButton(page, "Lẩu bò")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});

test("a press sends RM-13 at once, reloads and shows the rating", async ({
  page,
}) => {
  await open(page);
  expect(detailReads).toBe(1);
  await likeButton(page, "Phở bò").click();
  // No confirmation step: the rating is saved by the press itself.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await expect
    .poll(() => rateCalls)
    .toEqual([{ itemId: 1501, body: { value: "like" } }]);
  // RM-03 is read again: the pressed button and the dimmed one come from the backend.
  await expect.poll(() => detailReads).toBe(2);
  await expect(likeButton(page, "Phở bò")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(dislikeButton(page, "Phở bò")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  // The focus never left the button that was pressed.
  await expect(likeButton(page, "Phở bò")).toBeFocused();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Đã ghi nhận bạn thích Phở bò." }),
  ).toBeAttached();
  // The other dishes are untouched.
  await expect(likeButton(page, "Bún chả")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("dislike works the same and a rated dish cannot be rated again", async ({
  page,
}) => {
  await open(page);
  await dislikeButton(page, "Bún chả").click();
  await expect.poll(() => rateCalls.length).toBe(1);
  expect(rateCalls[0]).toEqual({ itemId: 1502, body: { value: "dislike" } });
  await expect(dislikeButton(page, "Bún chả")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Pressing a rated dish does nothing: no call.
  await likeButton(page, "Bún chả").click({ force: true });
  await dislikeButton(page, "Bún chả").click({ force: true });
  await likeButton(page, "Lẩu bò").click({ force: true });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(rateCalls).toHaveLength(1);
});

test("a double press sends one rating", async ({ page }) => {
  await open(page);
  await likeButton(page, "Phở bò").dblclick();
  await expect(likeButton(page, "Phở bò")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(rateCalls).toHaveLength(1);
});

test("a failed rating says why in the day and can be tried again", async ({
  page,
}) => {
  await open(page);
  failRate = { status: 503, errorCode: "SERVICE_UNAVAILABLE" };
  await likeButton(page, "Phở bò").click();
  await expect(page.locator(".roadmap-day-notice")).toContainText(
    "Chưa ghi nhận được đánh giá cho Phở bò. Hiện chưa kết nối được với hệ thống.",
  );
  await expect(likeButton(page, "Phở bò")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(detailReads).toBe(1);
  // The buttons are still there to press again.
  await likeButton(page, "Phở bò").click();
  await expect.poll(() => rateCalls.length).toBe(2);
  await expect(likeButton(page, "Phở bò")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("a dish rated elsewhere is explained and shown as rated", async ({
  page,
}) => {
  await open(page);
  // Rated from another tab in the meantime.
  detail.itinerary[0].items[0].myFeedback = "dislike";
  detail.itinerary[0].items[0].dish.dislikeCount += 1;
  await likeButton(page, "Phở bò").click();
  await expect(page.locator(".roadmap-day-notice")).toContainText(
    "Phở bò đã được đánh giá trước đó",
  );
  await expect(dislikeButton(page, "Phở bò")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(likeButton(page, "Phở bò")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});

test("a dish removed elsewhere is reported and the list refreshed", async ({
  page,
}) => {
  await open(page);
  detail.itinerary[0].items = detail.itinerary[0].items.filter(
    (entry) => entry.id !== 1502,
  );
  await likeButton(page, "Bún chả").click();
  await expect(page.locator(".roadmap-day-notice")).toContainText(
    "Bún chả không còn trong lộ trình",
  );
  await expect(page.locator("#day-1 .roadmap-item")).toHaveCount(2);
});

test("a saved rating whose reload fails says the buttons may be out of date", async ({
  page,
}) => {
  await open(page);
  failDetailReads = 1;
  await likeButton(page, "Phở bò").click();
  await expect(page.locator(".roadmap-day-notice")).toContainText(
    "Đã ghi nhận đánh giá nhưng chưa tải lại được lộ trình",
  );
  expect(rateCalls).toHaveLength(1);
});

test("the buttons fit from 320px to 1440px", async ({ page }) => {
  await open(page);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1800 });
    const group = card(page, "Phở bò").locator(".roadmap-item-actions");
    expect(
      await group.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
      `actions ${width}px`,
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `page ${width}px`,
    ).toBe(true);
  }
});
