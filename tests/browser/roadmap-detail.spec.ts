import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { stubMapboxRendering } from "./mapbox-fixture";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";
import type {
  RoadmapDetailDto,
  RoadmapItemDto,
  RoadmapRouteDto,
} from "../../src/features/roadmaps/roadmap-types";

/** F-21: RM-03 and RM-14 against a local stub shaped like the API Design JSON samples. */
let detail: RoadmapDetailDto;
let routeCalls: string[] = [];
let failRoute = 0;
let failDetail = 0;

function item(
  id: number,
  dayId: number,
  dayNumber: number,
  mealSlot: RoadmapItemDto["mealSlot"],
  name: string,
  price: number,
  latitude: number,
  longitude: number,
  extra: Omit<Partial<RoadmapItemDto>, "dish"> & {
    dish?: Partial<RoadmapItemDto["dish"]>;
  } = {},
): RoadmapItemDto {
  const { dish, ...rest } = extra;
  return {
    id,
    dayId,
    dayNumber,
    mealSlot,
    sortOrder: 0,
    source: "manual",
    recoRequestId: null,
    myFeedback: null,
    createdAt: "2026-10-02T02:10:00Z",
    dish: {
      id: id + 100,
      name,
      price,
      coverUrl: null,
      dishForm: "soup",
      isAvailable: true,
      likeCount: 128,
      dislikeCount: 9,
      tags: [],
      restaurant: {
        id: 7,
        name: `Quán ${name}`,
        district: "Quận Hải Châu",
        provinceName: "Thành phố Đà Nẵng",
        latitude,
        longitude,
        ratingAvg: 4.6,
      },
      status: "active",
      rank: null,
      ...dish,
    },
    ...rest,
  };
}

function sampleDetail(): RoadmapDetailDto {
  return {
    overview: {
      id: 88,
      title: "3 ngày ăn sập Đà Nẵng",
      startDate: "2026-10-10",
      endDate: "2026-10-12",
      numDays: 3,
      budgetAmount: 1500000,
      totalEstimatedCost: 195000,
      itemCount: 4,
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
        dayCost: 145000,
        items: [
          item(
            1502,
            301,
            1,
            "breakfast",
            "Bún bò Huế",
            45000,
            16.067812,
            108.220116,
            {
              myFeedback: "like",
            },
          ),
          item(1503, 301, 1, "lunch", "Mì Quảng", 40000, 16.07, 108.23),
          item(1504, 301, 1, "dinner", "Bánh xèo", 60000, 16.08, 108.24, {
            source: "ai",
          }),
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
        dayCost: 50000,
        items: [
          item(1601, 303, 3, "lunch", "Cao lầu", 50000, 15.88, 108.33, {
            dish: { status: "removed" },
          }),
        ],
      },
    ],
    budget: {
      budgetAmount: 1500000,
      totalEstimatedCost: 195000,
      remaining: 1305000,
      isOverBudget: false,
      byDay: [
        { dayNumber: 1, cost: 145000 },
        { dayNumber: 2, cost: 0 },
        { dayNumber: 3, cost: 50000 },
      ],
      byMealSlot: [
        { mealSlot: "breakfast", cost: 45000 },
        { mealSlot: "lunch", cost: 90000 },
        { mealSlot: "dinner", cost: 60000 },
      ],
    },
  };
}

/** RM-14 JSON sample (r1388–r1411), with the legs of the three stops of day 1. */
function routeFor(
  dayId: number,
  query: URLSearchParams,
): RoadmapRouteDto | null {
  const gps = query.has("originLat")
    ? {
        latitude: Number(query.get("originLat")),
        longitude: Number(query.get("originLng")),
        label: null,
        source: "gps" as const,
      }
    : null;
  if (dayId === 301) {
    const withOrigin = gps ?? detail.overview.originMode === "pinned";
    const legs = [
      ...(withOrigin
        ? [
            {
              fromItemId: null,
              toItemId: 1502,
              distanceMeters: 2350,
              durationSeconds: 540,
            },
          ]
        : []),
      {
        fromItemId: 1502,
        toItemId: 1503,
        distanceMeters: 3100,
        durationSeconds: 660,
      },
      {
        fromItemId: 1503,
        toItemId: 1504,
        distanceMeters: 2450,
        durationSeconds: 420,
      },
    ];
    return {
      dayId,
      profile: "driving",
      origin: gps
        ? gps
        : withOrigin
          ? {
              latitude: 16.061204,
              longitude: 108.227531,
              label: "Khách sạn Sala Đà Nẵng",
              source: "pinned",
            }
          : null,
      originSkipped: false,
      legs,
      totalDistanceMeters: legs.reduce(
        (sum, leg) => sum + leg.distanceMeters,
        0,
      ),
      totalDurationSeconds: legs.reduce(
        (sum, leg) => sum + leg.durationSeconds,
        0,
      ),
      isEstimated: false,
    };
  }
  if (dayId === 303)
    // A pinned origin more than 30 km from the only stop is skipped; Mapbox failed.
    return {
      dayId,
      profile: "driving",
      origin: null,
      originSkipped: true,
      legs: [],
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      isEstimated: true,
    };
  return null;
}

const roadmaps: StubHandler = ({ method, url }, send) => {
  if (method !== "GET") return false;
  const parsed = new URL(url, "http://stub");
  const path = parsed.pathname;
  if (path === "/api/v1/roadmaps")
    return (
      send(200, {
        items: [detail.overview],
        page: 1,
        pageSize: 9,
        totalItems: 1,
        totalPages: 1,
      }),
      true
    );
  if (path === "/api/v1/roadmaps/404")
    return (send(404, null, "ROADMAP_NOT_FOUND"), true);
  if (path === "/api/v1/roadmaps/88") {
    if (failDetail > 0) {
      failDetail -= 1;
      send(503, null, "SERVICE_UNAVAILABLE");
    } else send(200, detail);
    return true;
  }
  const match = /^\/api\/v1\/roadmaps\/88\/days\/(\d+)\/route$/.exec(path);
  if (!match) return false;
  routeCalls.push(`${match[1]}${parsed.search}`);
  if (failRoute > 0) {
    failRoute -= 1;
    send(503, null, "SERVICE_UNAVAILABLE");
    return true;
  }
  const route = routeFor(Number(match[1]), parsed.searchParams);
  if (route) send(200, route);
  else send(404, null, "DAY_NOT_FOUND");
  return true;
};

let stub: AccountStub;
test.beforeAll(async () => {
  await mkdir("artifacts/roadmap-detail", { recursive: true });
  stub = await startAccountStub(5164, roadmaps);
});
test.afterAll(async () => {
  await stopAccountStub(stub);
});
test.beforeEach(async ({ context }) => {
  stub.reset();
  detail = sampleDetail();
  routeCalls = [];
  failRoute = 0;
  failDetail = 0;
  await context.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    return ["localhost", "127.0.0.1"].includes(host)
      ? route.continue()
      : route.abort();
  });
});

const items = (page: Page) => page.locator(".roadmap-item");
const legs = (page: Page) => page.locator(".roadmap-leg");
// Days of the sample: 2026-10-10 (Saturday), 11 (Sunday), 12 (Monday).
const day1 = { name: "Thứ Bảy, 10 tháng 10" };
const day2 = { name: "Chủ Nhật, 11 tháng 10" };
const day3 = { name: "Thứ Hai, 12 tháng 10" };
const tab = (page: Page, name: string) =>
  page.getByRole("tab", { name, exact: true });
const main = (page: Page) => page.locator(".roadmap-detail-main");
const mapPanel = (page: Page) =>
  page.getByRole("region", { name: "Bản đồ lộ trình", exact: true });

async function bounds(locator: Locator) {
  return locator.evaluate((element) => {
    const { left, right, top, bottom, width, height } =
      element.getBoundingClientRect();
    return { left, right, top, bottom, width, height };
  });
}

async function open(page: Page, path = "/roadmaps/88") {
  await loginAs(page, "traveler");
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: detail.overview.title, level: 1 }),
  ).toBeVisible();
}

test("guests go to login, other roles to their landing page, a bad id shows the not-found page", async ({
  page,
}) => {
  await page.goto("/roadmaps/88");
  await expect(page).toHaveURL(/\/login$/);
  await loginAs(page, "owner");
  await page.goto("/roadmaps/88");
  await expect(page).toHaveURL(/\/restaurant$/);
  await loginAs(page, "traveler");
  for (const path of ["/roadmaps/abc", "/roadmaps/0", "/roadmaps/88x"]) {
    // The page streams inside the signed-in layout, so judge by what is rendered.
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Trang này chưa có" }),
      path,
    ).toBeVisible();
    await expect(page.locator(".roadmap-hero"), path).toHaveCount(0);
  }
});

test("RM-03 shows the hero, the day list, the first day with its legs and its total", async ({
  page,
}) => {
  await open(page);
  const hero = page.locator(".roadmap-hero");
  await expect(hero).toContainText("10 thg 10, 2026 – 12 thg 10, 2026");
  await expect(hero).toContainText("3 ngày");
  await expect(hero).toContainText("4 món");

  // Sidebar: every day with its short label and its dishes.
  const sidebar = page.getByRole("navigation", {
    name: "Các ngày của lộ trình",
  });
  await expect(sidebar.getByRole("button")).toHaveCount(3);
  await expect(sidebar.getByRole("button").first()).toContainText("T7 10/10");
  await expect(sidebar.getByRole("button").first()).toContainText(
    "Bún bò Huế · Mì Quảng · Bánh xèo",
  );
  await expect(sidebar.getByRole("button").nth(1)).toContainText("Chưa có món");

  // Itinerary is the default tab; the first day is open, the others are folded.
  await expect(tab(page, "Lịch trình")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("button", day1)).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByRole("button", day2)).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(
    page.getByRole("heading", { name: "Bữa sáng", level: 4 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Bữa trưa", level: 4 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Bữa tối", level: 4 }),
  ).toBeVisible();
  await expect(items(page)).toHaveCount(3);
  const first = items(page).first();
  await expect(first).toContainText("Bún bò Huế");
  await expect(first).toContainText("Dự chi 45.000 VND");
  await expect(first).toContainText("Quán Bún bò Huế · Quận Hải Châu");
  await expect(first).toContainText("4,6 sao");
  await expect(first).toContainText("Bạn đã thích món này");
  await expect(items(page).nth(2)).toContainText("ANGI gợi ý");

  // RM-14 sample: origin → 1, 1 → 2, 2 → 3, then the day total.
  await expect(legs(page)).toHaveCount(3);
  await expect(legs(page).nth(0)).toContainText("2,35 km · Khoảng 9 phút");
  await expect(legs(page).nth(0)).toContainText(
    "Khách sạn Sala Đà Nẵng → Bún bò Huế",
  );
  await expect(legs(page).nth(1)).toContainText("Bún bò Huế → Mì Quảng");
  await expect(legs(page).nth(2)).toContainText("Mì Quảng → Bánh xèo");
  await expect(page.locator(".roadmap-route-total")).toContainText(
    "7,9 km · 27 phút",
  );
  await expect(page.getByText("Ước tính", { exact: true })).toHaveCount(0);
  await expect(page.locator(".roadmap-day-total")).toContainText(
    "Tổng dự chi hôm nay: 145.000 VND",
  );
  expect(routeCalls).toEqual(["301"]);
});

test("the tabs switch between overview, itinerary and budget and follow ?tab=", async ({
  page,
}) => {
  await open(page);
  await tab(page, "Tổng quan").click();
  await expect(page).toHaveURL(/\/roadmaps\/88\?tab=overview$/);
  const overview = page.getByRole("tabpanel", { name: "Tổng quan" });
  await expect(overview).toContainText("10 thg 10, 2026 – 12 thg 10, 2026");
  await expect(overview).toContainText("Khách sạn Sala Đà Nẵng");
  await expect(overview).toContainText("1.500.000 VND / người");
  await expect(overview).toContainText("195.000 VND");
  await expect(overview).toContainText("Cập nhật lần cuối");
  await expect(page.getByRole("tabpanel", { name: "Lịch trình" })).toBeHidden();

  await tab(page, "Ngân sách").click();
  await expect(page).toHaveURL(/\/roadmaps\/88\?tab=budget$/);
  const budget = page.getByRole("tabpanel", { name: "Ngân sách" });
  await expect(
    budget.getByRole("heading", { name: "Ngân sách ăn uống" }),
  ).toBeVisible();
  await expect(budget.locator(".roadmap-budget-total")).toContainText(
    "195.000 VND",
  );
  await expect(budget).toContainText("Ngân sách 1.500.000 VND");
  await expect(budget).toContainText("Còn lại 1.305.000 VND");
  await expect(budget).toContainText("Đã dùng 13% ngân sách");
  await expect(budget.getByText("Ngày 3", { exact: true })).toBeVisible();
  await expect(budget.getByText("Bữa trưa", { exact: true })).toBeVisible();

  await tab(page, "Lịch trình").click();
  await expect(page).toHaveURL(/\/roadmaps\/88$/);
  await expect(items(page)).toHaveCount(3);
  // The itinerary kept its day and its legs: nothing was asked twice.
  expect(routeCalls).toEqual(["301"]);
});

test("the Google Maps button is built by the app from the item coordinates", async ({
  page,
}) => {
  await open(page);
  const link = main(page).getByRole("link", { name: /Mở trên Google Maps/ });
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  const href = (await link.getAttribute("href")) ?? "";
  const query = new URL(href).searchParams;
  expect(href.startsWith("https://www.google.com/maps/dir/?")).toBe(true);
  expect(query.get("origin")).toBe("16.061204,108.227531");
  expect(query.get("waypoints")).toBe("16.067812,108.220116|16.07,108.23");
  expect(query.get("destination")).toBe("16.08,108.24");
  expect(query.get("travelmode")).toBe("driving");
});

test("days fold and unfold, RM-14 is asked once per open day and skipped for empty days", async ({
  page,
}) => {
  await open(page);
  await expect.poll(() => routeCalls).toEqual(["301"]);

  await page.getByRole("button", day2).click();
  await expect(page).toHaveURL(/\/roadmaps\/88\?day=2$/);
  await expect(page.getByRole("button", day2)).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(main(page).getByText("Ngày này chưa có món nào.")).toBeVisible();
  // Days open independently: day 1 is still open and nothing was asked for the empty day.
  await expect(items(page)).toHaveCount(3);
  expect(routeCalls).toEqual(["301"]);

  await page.getByRole("button", day3).click();
  await expect(page).toHaveURL(/\/roadmaps\/88\?day=3$/);
  await expect(items(page)).toHaveCount(4);
  await expect(items(page).last()).toContainText("Món đã ngừng bán");
  // The only stop is more than 30 km away: the first leg is skipped and the figures estimated.
  await expect(
    main(page).getByText(/cách quán đầu tiên hơn 30 km/),
  ).toBeVisible();
  await expect(
    main(page).getByText("Chưa đủ điểm để tính quãng đường."),
  ).toBeVisible();
  await expect(
    main(page).getByText(/ước tính theo đường chim bay/),
  ).toBeVisible();
  expect(routeCalls).toEqual(["301", "303"]);

  await page.getByRole("button", day1).click();
  await expect(page.getByRole("button", day1)).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(items(page)).toHaveCount(1);
  await expect(
    page.locator(".roadmap-day-sub", {
      hasText: "Bún bò Huế · Mì Quảng · Bánh xèo",
    }),
  ).toBeVisible();
  await page.getByRole("button", day1).click();
  await expect(legs(page)).toHaveCount(3);
  // Day 1 was already loaded: nothing is asked twice.
  expect(routeCalls).toEqual(["301", "303"]);
});

test("the sidebar opens a day from any tab and brings it into view", async ({
  page,
}) => {
  await open(page, "/roadmaps/88?tab=budget");
  // Nothing about routes is asked while the itinerary is not on screen.
  expect(routeCalls).toEqual([]);
  const sidebar = page.getByRole("navigation", {
    name: "Các ngày của lộ trình",
  });
  await sidebar.getByRole("button", { name: /T2 12\/10/ }).click();
  await expect(tab(page, "Lịch trình")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page).toHaveURL(/\/roadmaps\/88\?day=3$/);
  await expect(page.getByRole("button", day3)).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByRole("button", day3)).toBeInViewport();
  await expect(
    sidebar.getByRole("button", { name: /T2 12\/10/ }),
  ).toHaveAttribute("aria-current", "true");
  // The first day was open from the start, so both days ask once the itinerary shows.
  await expect.poll(() => routeCalls.slice().sort()).toEqual(["301", "303"]);
});

test("a deep link ?day=3 opens that day and an out-of-range day falls back to day 1", async ({
  page,
}) => {
  await open(page, "/roadmaps/88?day=3");
  await expect(page.getByRole("button", day3)).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByRole("button", day1)).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.goto("/roadmaps/88?day=9&tab=nope");
  await expect(page.getByRole("button", day1)).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(tab(page, "Lịch trình")).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("a roadmap without an origin starts its legs at the first stop", async ({
  page,
}) => {
  detail.overview.originMode = "none";
  detail.overview.originLatitude = null;
  detail.overview.originLongitude = null;
  detail.overview.originLabel = null;
  await open(page);
  // Without an origin the legs start at the first stop.
  await expect(legs(page)).toHaveCount(2);
  await expect(legs(page).first()).toContainText("Bún bò Huế → Mì Quảng");
  await tab(page, "Tổng quan").click();
  await expect(page.getByRole("tabpanel", { name: "Tổng quan" })).toContainText(
    "Chưa có vị trí",
  );
  await tab(page, "Lịch trình").click();
  const query = new URL(
    (await main(page)
      .getByRole("link", { name: /Mở trên Google Maps/ })
      .getAttribute("href")) ?? "",
  ).searchParams;
  expect(query.has("origin")).toBe(false);
});

test("a failed RM-14 call keeps the day readable and can be retried", async ({
  page,
}) => {
  failRoute = 1;
  await open(page);
  await expect(main(page).locator(".alert-error")).toContainText(
    "Hiện chưa kết nối được với hệ thống.",
  );
  await expect(items(page)).toHaveCount(3);
  await expect(legs(page)).toHaveCount(0);
  await tab(page, "Tổng quan").click();
  await tab(page, "Lịch trình").click();
  expect(routeCalls).toEqual(["301"]);
  await main(page).getByRole("button", { name: "Thử lại" }).click();
  await expect(legs(page)).toHaveCount(3);
  await expect(main(page).locator(".alert-error")).toHaveCount(0);
  expect(routeCalls).toEqual(["301", "301"]);
});

test("a gps roadmap asks the browser for the position, then sends it with RM-14", async ({
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
  // Nothing is sent about the device until the traveler asks for it.
  await expect(legs(page)).toHaveCount(2);
  expect(routeCalls).toEqual(["301"]);

  await page.getByRole("button", { name: "Tính từ vị trí hiện tại" }).click();
  await expect(legs(page)).toHaveCount(3);
  await expect(legs(page).first()).toContainText("Điểm xuất phát → Bún bò Huế");
  expect(routeCalls).toEqual([
    "301",
    "301?originLat=16.0678&originLng=108.2208",
  ]);
  await expect(page.getByText(/Tọa độ không được lưu/)).toBeVisible();

  await page.getByRole("button", { name: "Bỏ vị trí hiện tại" }).click();
  await expect(legs(page)).toHaveCount(2);
  // The first answer is reused, so dropping the position costs no new request.
  expect(routeCalls).toHaveLength(2);
});

test("a blocked location explains what to do and keeps the legs between the stops", async ({
  page,
  context,
}) => {
  detail.overview.originMode = "gps";
  await context.clearPermissions();
  await open(page);
  await page.getByRole("button", { name: "Tính từ vị trí hiện tại" }).click();
  await expect(
    page.getByText(/Trình duyệt đang chặn vị trí của trang này/),
  ).toBeVisible();
  await expect(legs(page)).toHaveCount(2);
  expect(routeCalls).toEqual(["301"]);
});

test("an over-budget roadmap is flagged and a roadmap without budget says so", async ({
  page,
}) => {
  detail.overview.budgetAmount = 150000;
  detail.budget = {
    ...detail.budget,
    budgetAmount: 150000,
    remaining: -45000,
    isOverBudget: true,
  };
  await open(page, "/roadmaps/88?tab=budget");
  await expect(page.locator(".roadmap-hero")).toContainText("Vượt ngân sách");
  const budget = page.getByRole("tabpanel", { name: "Ngân sách" });
  await expect(budget).toContainText(
    "Chi phí dự kiến vượt ngân sách 45.000 VND.",
  );
  await expect(budget).not.toContainText("Còn lại");

  detail.overview.budgetAmount = null;
  detail.budget = {
    ...detail.budget,
    budgetAmount: null,
    remaining: null,
    isOverBudget: false,
  };
  await page.reload();
  await expect(budget).toContainText("Lộ trình chưa đặt ngân sách.");
  await expect(budget).toContainText("Chưa đặt ngân sách");
  await expect(budget.locator("progress")).toHaveCount(0);
});

test("a missing roadmap and a failed load are told apart", async ({ page }) => {
  await loginAs(page, "traveler");
  await page.goto("/roadmaps/404");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy lộ trình" }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: "Về lộ trình của tôi" })
    .click();
  await expect(page).toHaveURL(/\/roadmaps$/);

  failDetail = 1;
  await page.goto("/roadmaps/88");
  await expect(
    page.getByRole("heading", { name: "Chưa tải được lộ trình" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(
    page.getByRole("heading", { name: "3 ngày ăn sập Đà Nẵng", level: 1 }),
  ).toBeVisible();
});

test("a card of the list opens its detail page", async ({ page }) => {
  await loginAs(page, "traveler");
  await page.goto("/roadmaps");
  await page.getByRole("link", { name: "3 ngày ăn sập Đà Nẵng" }).click();
  await expect(page).toHaveURL(/\/roadmaps\/88$/);
  await expect(
    page.getByRole("heading", { name: "3 ngày ăn sập Đà Nẵng", level: 1 }),
  ).toBeVisible();
  await page.getByRole("link", { name: "← Lộ trình của tôi" }).click();
  await expect(page).toHaveURL(/\/roadmaps$/);
});

for (const width of [1024, 1440]) {
  test(`the sidebar, detail and map occupy three distinct columns at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    const sidebar = page.locator(".roadmap-detail-nav");
    await expect(sidebar).toBeVisible();
    await expect(main(page)).toBeVisible();
    await expect(mapPanel(page)).toBeVisible();
    const [left, center, right] = await Promise.all([
      bounds(sidebar),
      bounds(main(page)),
      bounds(mapPanel(page)),
    ]);
    expect(left.left).toBeGreaterThanOrEqual(0);
    expect(left.right).toBeLessThanOrEqual(center.left + 1);
    expect(center.right).toBeLessThanOrEqual(right.left + 1);
    expect(center.width).toBeGreaterThanOrEqual(280);
    expect(right.width).toBeGreaterThanOrEqual(240);
    expect(right.right).toBeLessThanOrEqual(width + 1);
    expect(routeCalls).toEqual(["301"]);
  });
}

test("sidebar and map stay in view while a long itinerary scrolls independently", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  detail.overview = {
    ...detail.overview,
    title: "Mười ngày ăn ngon Đà Nẵng",
    numDays: 10,
    endDate: "2026-10-19",
  };
  const extraDays = Array.from({ length: 7 }, (_, index) => ({
    dayId: 304 + index,
    dayNumber: 4 + index,
    date: `2026-10-${13 + index}`,
    note: null,
    dayCost: 0,
    items: [],
  }));
  detail.itinerary.push(...extraDays);
  detail.budget.byDay.push(
    ...extraDays.map((day) => ({ dayNumber: day.dayNumber, cost: 0 })),
  );
  await open(page);
  const sidebar = page.locator(".roadmap-detail-nav");
  const map = mapPanel(page);
  const hero = main(page).locator(".roadmap-hero");
  const scrollDetail = async (amount: number) => {
    await main(page).evaluate((element, distance) => {
      const overflow = getComputedStyle(element).overflowY;
      if (
        /auto|scroll/.test(overflow) &&
        element.scrollHeight > element.clientHeight
      )
        element.scrollBy({ top: distance, behavior: "instant" });
      else window.scrollBy({ top: distance, behavior: "instant" });
    }, amount);
  };
  // Start after the sticky columns have reached their pinned positions.
  await scrollDetail(280);
  const [leftBefore, mapBefore, heroBefore] = await Promise.all([
    bounds(sidebar),
    bounds(map),
    bounds(hero),
  ]);
  await scrollDetail(260);
  await expect
    .poll(async () => heroBefore.top - (await bounds(hero)).top)
    .toBeGreaterThan(150);
  const [leftAfter, mapAfter] = await Promise.all([
    bounds(sidebar),
    bounds(map),
  ]);
  expect(Math.abs(leftAfter.top - leftBefore.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(mapAfter.top - mapBefore.top)).toBeLessThanOrEqual(2);
  await expect(sidebar).toBeInViewport({ ratio: 0.4 });
  await expect(map).toBeInViewport({ ratio: 0.4 });
  expect(routeCalls).toEqual(["301"]);
});

test("an unconfigured map keeps real stop details usable without provider requests", async ({
  page,
}) => {
  let providerRequests = 0;
  page.on("request", (request) => {
    if (/mapbox\.(com|cn)/.test(new URL(request.url()).hostname))
      providerRequests++;
  });
  detail.itinerary[0].items[0].dish.coverUrl = "/assets/figma/dish-0.png";
  await open(page);
  const map = mapPanel(page);
  await expect(map).toContainText("Bản đồ chưa sẵn sàng");
  await expect(map.locator(".mapboxgl-canvas")).toHaveCount(0);
  const stopButtons = map.getByRole("button", { name: /^Xem vị trí / });
  await expect(stopButtons).toHaveCount(4);
  const selected = map.locator(".roadmap-map-card");
  const first = main(page).getByRole("button", {
    name: "Xem vị trí Bún bò Huế",
    exact: true,
  });
  await first.focus();
  await first.press("Enter");
  await expect(selected).toContainText("Quán Bún bò Huế");
  await expect(selected).toContainText("45.000 VND");
  await expect(selected).toContainText("Thành phố Đà Nẵng");
  await expect(selected.locator(".roadmap-map-card-photo img")).toHaveAttribute(
    "src",
    "/assets/figma/dish-0.png",
  );
  await map
    .getByRole("button", { name: "Xem vị trí Mì Quảng", exact: true })
    .click();
  await expect(selected).toContainText("Quán Mì Quảng");
  await expect(selected).toContainText("40.000 VND");
  await expect(selected).not.toContainText("Quán Bún bò Huế");
  await map.getByRole("button", { name: "Đóng thông tin địa điểm" }).click();
  await expect(selected).toHaveCount(0);
  await expect(stopButtons).toHaveCount(4);
  expect(providerRequests).toBe(0);
  expect(routeCalls).toEqual(["301"]);
});

test("a roadmap without dishes explains the empty map instead of leaving a blank panel", async ({
  page,
}) => {
  let providerRequests = 0;
  page.on("request", (request) => {
    if (/mapbox\.(com|cn)/.test(new URL(request.url()).hostname))
      providerRequests++;
  });
  for (const day of detail.itinerary) day.items = [];
  detail.overview.itemCount = 0;
  await open(page);
  const map = mapPanel(page);
  await expect(map).toContainText("Lộ trình chưa có địa điểm để hiển thị.");
  await expect(map).toContainText("0/0 điểm có tọa độ");
  // No dish means no list of stops, so no empty white card is drawn.
  await expect(map.locator(".roadmap-map-stop-list")).toHaveCount(0);
  await expect(map.locator(".mapboxgl-canvas")).toHaveCount(0);
  expect(providerRequests).toBe(0);
  expect(routeCalls).toEqual([]);
});

test("a stop without coordinates keeps its details selectable and is omitted from Maps directions", async ({
  page,
}) => {
  detail.itinerary[0].items[0].dish.restaurant.latitude = null;
  detail.itinerary[0].items[0].dish.restaurant.longitude = null;
  await open(page);
  const map = mapPanel(page);
  await map
    .getByRole("button", { name: "Xem vị trí Bún bò Huế", exact: true })
    .click();
  const selected = map.locator(".roadmap-map-card");
  await expect(selected).toContainText("Quán Bún bò Huế");
  await expect(selected).toContainText(
    "Địa điểm này chưa có tọa độ trên bản đồ.",
  );
  const link = main(page).getByRole("link", { name: /Mở trên Google Maps/ });
  const query = new URL((await link.getAttribute("href")) ?? "").searchParams;
  expect(query.get("waypoints")).toBe("16.07,108.23");
  expect(query.get("destination")).toBe("16.08,108.24");
  expect(routeCalls).toEqual(["301"]);
});

test.describe("offline Mapbox roadmap rendering", () => {
  test.skip(
    process.env.ANGI_TEST_MAPBOX_OFFLINE !== "1",
    "Use playwright.roadmap-map.config.ts with ANGI_TEST_MAPBOX_OFFLINE=1 and its fake token.",
  );

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Page-level handlers fulfill provider URLs before the context's external-request guard.
    await stubMapboxRendering(page);
  });

  test("a roadmap without dishes still draws the base map and says why it has no pin", async ({
    page,
  }) => {
    for (const day of detail.itinerary) day.items = [];
    detail.overview.itemCount = 0;
    await open(page);
    const map = mapPanel(page);
    await expect(map).toHaveAttribute("data-ready", "true");
    await expect(map.locator(".mapboxgl-canvas")).toBeVisible();
    await expect(map.locator(".roadmap-map-pin")).toHaveCount(0);
    await expect(map).toContainText("Lộ trình chưa có địa điểm để hiển thị.");
    await expect(map.locator(".roadmap-map-stop-list")).toHaveCount(0);
  });

  test("numbered pins and keyboard selection stay synchronized with the center cards", async ({
    page,
  }) => {
    await open(page);
    const map = mapPanel(page);
    await expect(map).toHaveAttribute("data-ready", "true");
    await expect(map.locator(".mapboxgl-canvas")).toBeVisible();
    await expect(map.locator(".roadmap-map-pin")).toHaveCount(4);
    const first = map.getByRole("button", {
      name: "Điểm 1, ngày 1: Bún bò Huế",
      exact: true,
    });
    const second = map.getByRole("button", {
      name: "Điểm 2, ngày 1: Mì Quảng",
      exact: true,
    });
    await expect(first).toHaveText("1");
    await expect(second).toHaveText("2");
    await expect(first).toHaveAttribute("data-tone", "0");
    await expect(
      map.getByRole("button", {
        name: "Điểm 1, ngày 3: Cao lầu",
        exact: true,
      }),
    ).toHaveAttribute("data-tone", "2");
    await second.focus();
    await second.press("Enter");
    await expect(second).toHaveAttribute("aria-pressed", "true");
    await expect(items(page).nth(1)).toHaveAttribute("data-selected", "true");
    await expect(map.locator(".roadmap-map-card")).toContainText(
      "Quán Mì Quảng",
    );
    // Northern/eastern and lowest pins must remain clickable outside the map
    // toolbar and the selected-place card, not merely keyboard-accessible.
    await map
      .getByRole("button", { name: "Điểm 3, ngày 1: Bánh xèo", exact: true })
      .click();
    await expect(items(page).nth(2)).toHaveAttribute("data-selected", "true");
    await first.click();
    await expect(items(page).first()).toHaveAttribute("data-selected", "true");
    const centerChoice = main(page).getByRole("button", {
      name: "Xem vị trí Bún bò Huế",
      exact: true,
    });
    await centerChoice.focus();
    await centerChoice.press("Space");
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expect(second).toHaveAttribute("aria-pressed", "false");
    await expect(items(page).first()).toHaveAttribute("data-selected", "true");
    await expect(map.locator(".roadmap-map-card")).toContainText(
      "Quán Bún bò Huế",
    );
    expect(routeCalls).toEqual(["301"]);
  });

  test("closing selected stop information preserves every pin and the loaded map", async ({
    page,
  }) => {
    await open(page);
    const map = mapPanel(page);
    await expect(map).toHaveAttribute("data-ready", "true");
    const pins = map.locator(".roadmap-map-pin");
    await expect(pins).toHaveCount(4);
    const labels = await pins.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("aria-label")),
    );
    const first = map.getByRole("button", {
      name: "Điểm 1, ngày 1: Bún bò Huế",
      exact: true,
    });
    await first.focus();
    await first.press("Enter");
    await expect(map.locator(".roadmap-map-card")).toBeVisible();
    await map.getByRole("button", { name: "Đóng thông tin địa điểm" }).click();
    await expect(map.locator(".roadmap-map-card")).toHaveCount(0);
    await expect(pins).toHaveCount(4);
    expect(
      await pins.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("aria-label")),
      ),
    ).toEqual(labels);
    await expect(first).toHaveAttribute("aria-pressed", "false");
    await expect(map).toHaveAttribute("data-ready", "true");
    await expect(map.locator(".mapboxgl-canvas")).toBeVisible();
    expect(routeCalls).toEqual(["301"]);
  });

  test("a missing-coordinate stop stays selectable without creating a fabricated pin", async ({
    page,
  }) => {
    detail.itinerary[0].items[0].dish.restaurant.latitude = null;
    detail.itinerary[0].items[0].dish.restaurant.longitude = null;
    await open(page);
    const map = mapPanel(page);
    await expect(map).toHaveAttribute("data-ready", "true");
    await expect(map.locator(".roadmap-map-pin")).toHaveCount(3);
    await expect(
      map.getByRole("button", {
        name: "Điểm 1, ngày 1: Bún bò Huế",
        exact: true,
      }),
    ).toHaveCount(0);
    await map.locator(".roadmap-map-stop-list > summary").click();
    const choices = map.getByRole("button", { name: /^Xem vị trí / });
    await expect(choices).toHaveCount(4);
    await map
      .getByRole("button", {
        name: "Xem vị trí Bún bò Huế",
        exact: true,
      })
      .click();
    const selected = map.locator(".roadmap-map-card");
    await expect(selected).toContainText("Quán Bún bò Huế");
    await expect(selected).toContainText(
      "Địa điểm này chưa có tọa độ trên bản đồ.",
    );
    await expect(items(page).first()).toHaveAttribute("data-selected", "true");
    await expect(map.locator(".roadmap-map-pin")).toHaveCount(3);
    expect(routeCalls).toEqual(["301"]);
  });

  test("a local style error keeps itinerary and stop details readable and can recover", async ({
    page,
  }) => {
    await page.route("https://api.mapbox.com/styles/**", (route) =>
      route.fulfill({ status: 401, json: { message: "Offline style denied" } }),
    );
    await open(page);
    const map = mapPanel(page);
    await expect(map).toContainText("Chưa tải được bản đồ");
    await expect(map).toHaveAttribute("data-ready", "false");
    await expect(map.locator(".mapboxgl-canvas")).toHaveCount(0);
    await expect(items(page)).toHaveCount(3);
    await expect(legs(page)).toHaveCount(3);
    await main(page)
      .getByRole("button", {
        name: "Xem vị trí Mì Quảng",
        exact: true,
      })
      .click();
    await expect(map.locator(".roadmap-map-card")).toContainText(
      "Quán Mì Quảng",
    );
    // Restore the local style fixture, never the network, before retrying.
    await page.unroute("https://api.mapbox.com/styles/**");
    await map.getByRole("button", { name: "Thử lại bản đồ" }).click();
    await expect(map).toHaveAttribute("data-ready", "true");
    await expect(map.locator(".roadmap-map-pin")).toHaveCount(4);
    await expect(map.locator(".roadmap-map-card")).toContainText(
      "Quán Mì Quảng",
    );
    expect(routeCalls).toEqual(["301"]);
  });

  test("the Figma layout and exact assets fit desktop, tablet and mobile", async ({
    page,
  }) => {
    const cameraProblems: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Map cannot fit within canvas"))
        cameraProblems.push(message.text());
    });
    // API fixture imagery only: no sample names or photos enter the production page.
    detail.overview.coverUrl = "/assets/figma/roadmap-food.png";
    const foodPhotos = [
      ["Phở bò", "/assets/figma/dish-0.png"],
      ["Bánh mì trứng", "/assets/figma/roll-1.png"],
      ["Gỏi cuốn tôm", "/assets/figma/dish-3.png"],
      ["Cơm tấm", "/assets/figma/roll-3.png"],
    ] as const;
    detail.itinerary
      .flatMap((day) => day.items)
      .forEach((entry, index) => {
        const [name, coverUrl] = foodPhotos[index];
        entry.dish.name = name;
        entry.dish.coverUrl = coverUrl;
        entry.dish.restaurant.name = `Quán ${name}`;
      });
    await page.setViewportSize({ width: 1713, height: 988 });
    await open(page);
    const map = mapPanel(page);
    await expect(map).toHaveAttribute("data-ready", "true");
    await expect(legs(page)).toHaveCount(3);
    await main(page)
      .getByRole("button", {
        name: "Xem vị trí Phở bò",
        exact: true,
      })
      .click();
    const card = map.locator(".roadmap-map-card");
    await expect(card).toContainText("Quán Phở bò");
    // Check the selected dish image's real rendering before returning to the info view.
    await card.getByRole("tab", { name: "Ảnh món", exact: true }).click();
    const selectedPhoto = card.locator(".roadmap-map-card-photo img");
    await expect(selectedPhoto).toBeVisible();
    await expect
      .poll(() =>
        selectedPhoto.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
      )
      .toBe(true);
    await expect(selectedPhoto).toHaveCSS("object-fit", "cover");
    await card.getByRole("tab", { name: "Thông tin", exact: true }).click();

    const geometry = [
      [
        ".roadmap-chevron .icon-roadmap-chevron img",
        "roadmap-chevron.svg",
        17.5,
        14,
      ],
      [".roadmap-leg .icon-motorcycle img", "motorcycle.svg", 20, 20],
      [".roadmap-leg .icon-connection img", "connection.svg", 16, 64],
    ] as const;
    const viewports = [
      { width: 1713, height: 988, name: "figma-layout-1713" },
      { width: 1440, height: 988, name: "desktop-1440" },
      { width: 768, height: 1024, name: "tablet-768" },
      { width: 390, height: 844, name: "mobile-390" },
      { width: 320, height: 844, name: "mobile-320" },
    ];
    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      });
      await expect
        .poll(() =>
          page.locator(".roadmap-detail img").evaluateAll((elements) =>
            elements.every((element) => {
              const image = element as HTMLImageElement;
              return image.complete && image.naturalWidth > 0;
            }),
          ),
        )
        .toBe(true);
      const photos = main(page).locator(
        ".roadmap-item-media img, .roadmap-hero-media img",
      );
      await expect(photos).toHaveCount(4);
      expect(
        await photos.evaluateAll((images) =>
          images.every((image) => {
            const box = image.getBoundingClientRect();
            const parent = image.parentElement?.getBoundingClientRect();
            if (!parent) return false;
            return (
              box.width > 0 &&
              box.height > 0 &&
              box.width <= parent.width + 1 &&
              box.height <= parent.height + 1 &&
              getComputedStyle(image).objectFit === "cover"
            );
          }),
        ),
        `${viewport.width}px food image fit`,
      ).toBe(true);
      for (const [selector, source, width, height] of geometry) {
        const image = main(page).locator(selector).first();
        await expect(image).toHaveAttribute("src", `/assets/figma/${source}`);
        const measured = await image.evaluate(
          async (element: HTMLImageElement) => {
            // Inspect only SVG root metadata and effective layout geometry.
            const response = await fetch(element.currentSrc);
            const root = new DOMParser().parseFromString(
              await response.text(),
              "image/svg+xml",
            ).documentElement;
            const box = element.getBoundingClientRect();
            return {
              intrinsicWidth: Number(root.getAttribute("width")),
              intrinsicHeight: Number(root.getAttribute("height")),
              width: box.width,
              height: box.height,
            };
          },
        );
        expect(measured.intrinsicWidth, source).toBe(width);
        expect(measured.intrinsicHeight, source).toBe(height);
        expect(measured.width, `${source} at ${viewport.width}px`).toBeCloseTo(
          width,
          1,
        );
        expect(measured.height, `${source} at ${viewport.width}px`).toBeCloseTo(
          height,
          1,
        );
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${viewport.width}px page width`,
      ).toBeLessThanOrEqual(viewport.width);
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await page.screenshot({
        path: `artifacts/roadmap-detail/${viewport.name}.png`,
        animations: "disabled",
      });
      await main(page).screenshot({
        path: `artifacts/roadmap-detail/center-stops-${viewport.width}.png`,
        animations: "disabled",
      });
      await card.screenshot({
        path: `artifacts/roadmap-detail/selected-map-card-${viewport.width}.png`,
        animations: "disabled",
      });
    }
    // On a narrow viewport, selecting a center card brings the map details into
    // view; selecting a stop from the map keeps that card in view.
    await map.getByRole("button", { name: "Đóng thông tin địa điểm" }).click();
    await main(page)
      .getByRole("button", { name: "Xem vị trí Phở bò", exact: true })
      .click();
    await expect(card).toBeInViewport({ ratio: 0.7 });
    await map.getByRole("button", { name: "Đóng thông tin địa điểm" }).click();
    await map.locator(".roadmap-map-stop-list > summary").click();
    await map
      .getByRole("button", { name: "Xem vị trí Bánh mì trứng", exact: true })
      .click();
    await expect(card).toContainText("Quán Bánh mì trứng");
    await expect(card).toBeInViewport({ ratio: 0.7 });
    expect(cameraProblems).toEqual([]);
    expect(routeCalls).toEqual(["301"]);
  });
});

test("the detail page has no horizontal overflow from 320px to 1440px", async ({
  page,
}) => {
  detail.itinerary[0].items[0].dish.name = "Một món ăn có tên rất dài ".repeat(
    5,
  );
  detail.itinerary[0].items[0].dish.restaurant.name =
    "Một nhà hàng có tên rất dài ".repeat(5);
  detail.overview.title = "Một tên lộ trình rất dài ".repeat(6);
  await loginAs(page, "traveler");
  await page.goto("/roadmaps/88");
  await expect(page.locator(".roadmap-item").first()).toBeVisible();
  await expect(legs(page).first()).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(mapPanel(page)).toBeVisible();
    const map = await bounds(mapPanel(page));
    expect(map.left, `${width}px map left edge`).toBeGreaterThanOrEqual(-1);
    expect(map.right, `${width}px map right edge`).toBeLessThanOrEqual(
      width + 1,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${width}px`,
    ).toBe(true);
  }
});
