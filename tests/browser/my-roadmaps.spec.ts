import { expect, test, type Page } from "@playwright/test";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";
import type { RoadmapSummaryDto } from "../../src/features/roadmaps/roadmap-types";

/** F-20: RM-02 against a local stub that applies the backend paging rules. */
const pageSize = 12;
let rows: RoadmapSummaryDto[] = [];
let listCalls: string[] = [];
let failures = 0;
let deleteCalls: number[] = [];
let failDelete: { status: number; errorCode: string } | null = null;

// RM-02 JSON sample (API Design v1.8, sheet "JSON mẫu", r866–r894).
const sample: RoadmapSummaryDto = {
  id: 88,
  title: "3 ngày ăn sập Đà Nẵng",
  startDate: "2026-10-10",
  endDate: "2026-10-12",
  numDays: 3,
  budgetAmount: 1500000,
  totalEstimatedCost: 640000,
  itemCount: 9,
  coverUrl: null,
  originMode: "pinned",
  originLatitude: 16.061204,
  originLongitude: 108.227531,
  originLabel: "Khách sạn Sala Đà Nẵng",
  createdAt: "2026-10-02T02:00:00Z",
  updatedAt: "2026-10-02T03:00:00Z",
};

/** `count` roadmaps, newest first like the backend (createdAt descending). */
function many(count: number): RoadmapSummaryDto[] {
  return Array.from({ length: count }, (_, index) => ({
    ...sample,
    id: 1000 - index,
    title: `Lộ trình số ${index + 1}`,
  }));
}

const roadmaps: StubHandler = ({ method, url }, send) => {
  // RM-05: soft delete, 200 OK with data null; ROADMAP_NOT_FOUND when it is not there.
  const remove = /^\/api\/v1\/roadmaps\/(\d+)$/.exec(url);
  if (method === "DELETE" && remove) {
    const roadmapId = Number(remove[1]);
    deleteCalls.push(roadmapId);
    if (failDelete) {
      send(failDelete.status, null, failDelete.errorCode);
      return true;
    }
    const before = rows.length;
    rows = rows.filter((row) => row.id !== roadmapId);
    if (rows.length === before) send(404, null, "ROADMAP_NOT_FOUND");
    else send(200, null);
    return true;
  }
  if (method !== "GET" || !url.startsWith("/api/v1/roadmaps?")) return false;
  listCalls.push(url.slice("/api/v1/roadmaps?".length));
  const query = new URL(url, "http://stub").searchParams;
  const page = Number(query.get("page"));
  const size = Number(query.get("pageSize"));
  // Failures are for the list page; the prefetched /roadmaps/start check (pageSize=1) is
  // answered normally, whenever it happens to run.
  if (failures > 0 && size !== 1) {
    failures -= 1;
    send(503, null, "SERVICE_UNAVAILABLE");
    return true;
  }
  // GetMyRoadmapsRequestDtoValidator: page >= 1, pageSize 1..100.
  if (!Number.isInteger(page) || page < 1 || !(size >= 1 && size <= 100)) {
    send(400, null, "VALIDATION_FAILED", {
      Page: ["Trang phải bắt đầu từ 1."],
    });
    return true;
  }
  send(200, {
    items: rows.slice((page - 1) * size, page * size),
    page,
    pageSize: size,
    totalItems: rows.length,
    totalPages: Math.ceil(rows.length / size),
  });
  return true;
};

let stub: AccountStub;
test.beforeAll(async () => {
  stub = await startAccountStub(5164, roadmaps);
});
test.afterAll(async () => {
  await stopAccountStub(stub);
});
test.beforeEach(() => {
  stub.reset();
  rows = [];
  listCalls = [];
  failures = 0;
  deleteCalls = [];
  failDelete = null;
});

const cards = (page: Page) => page.locator(".roadmap-card");
// RM-02 calls of the list page. The header's "Lộ trình" link goes to /roadmaps/start, which
// asks RM-02 for one roadmap (pageSize=1); production builds prefetch it at any moment.
const listPageCalls = () =>
  listCalls.filter((query) => query.endsWith(`&pageSize=${pageSize}`));

async function open(page: Page, path = "/roadmaps") {
  await loginAs(page, "traveler");
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Lộ trình của tôi", level: 1 }),
  ).toBeVisible();
}

test("guests go to login and other roles to their own landing page", async ({
  page,
}) => {
  await page.goto("/roadmaps");
  await expect(page).toHaveURL(/\/login$/);
  await loginAs(page, "owner");
  await page.goto("/roadmaps");
  await expect(page).toHaveURL(/\/restaurant$/);
});

test("the Traveler header links to the list and marks it as current", async ({
  page,
}) => {
  rows = [sample];
  await open(page);
  await expect(
    page
      .getByRole("navigation", { name: "Điều hướng chính" })
      .getByRole("link", { name: "Lộ trình", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("RM-02 shows the cards of the documented sample", async ({ page }) => {
  rows = [sample];
  await open(page);
  // The heading renders before RM-02 is sent, so wait for the request instead of reading it once.
  await expect.poll(listPageCalls).toEqual([`page=1&pageSize=${pageSize}`]);
  const card = cards(page).first();
  await expect(
    card.getByRole("heading", { name: "3 ngày ăn sập Đà Nẵng" }),
  ).toBeVisible();
  // Cover, title and one line of who, when, how long and how many dishes.
  await expect(card).toContainText("10 – 12 thg 10, 2026");
  await expect(card).toContainText("3 ngày");
  await expect(card).toContainText("9 món");
  await expect(card).not.toContainText("Vượt ngân sách");
  // The share action opens the guide editor with this roadmap attached.
  await expect(
    card.getByRole("link", { name: "Chia sẻ lộ trình 3 ngày ăn sập Đà Nẵng" }),
  ).toHaveAttribute("href", `/guides/new?roadmap=${sample.id}`);
  await expect(page.getByText("Bạn có 1 lộ trình")).toBeVisible();
  // One page only: no pager.
  await expect(page.getByRole("button", { name: "Trang sau" })).toHaveCount(0);
});

test("a roadmap without dates, items, budget or origin still reads clearly", async ({
  page,
}) => {
  rows = [
    {
      ...sample,
      id: 2,
      title: "Chuyến chưa có kế hoạch",
      startDate: null,
      endDate: null,
      budgetAmount: null,
      totalEstimatedCost: 0,
      itemCount: 0,
      originMode: "none",
      originLatitude: null,
      originLongitude: null,
      originLabel: null,
    },
    {
      ...sample,
      id: 3,
      title: "Chuyến vượt ngân sách",
      totalEstimatedCost: 1600000,
    },
  ];
  await open(page);
  const empty = cards(page).filter({ hasText: "Chuyến chưa có kế hoạch" });
  await expect(empty).toContainText("Chưa chọn ngày đi");
  await expect(empty).toContainText("Chưa có món");
  // Budget and origin are on the detail page, not on the card.
  await expect(empty).not.toContainText("Xuất phát");
  await expect(
    cards(page).filter({ hasText: "Chuyến vượt ngân sách" }),
  ).toContainText("Vượt ngân sách");
});

test("pages follow ?page= in the URL, with the last page as the fallback past the end", async ({
  page,
}) => {
  rows = many(15);
  await open(page);
  await expect(cards(page)).toHaveCount(12);
  await expect(page.getByText("1–12 trên 15 mục · Trang 1 / 2")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Trang trước" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Trang sau" }).click();
  await expect(page).toHaveURL(/\/roadmaps\?page=2$/);
  await expect(cards(page)).toHaveCount(3);
  await expect(page.getByText("13–15 trên 15 mục · Trang 2 / 2")).toBeVisible();
  expect(listPageCalls().at(-1)).toBe(`page=2&pageSize=${pageSize}`);
  await page.getByRole("button", { name: "Trang trước" }).click();
  await expect(page).toHaveURL(/\/roadmaps$/);
  await expect(cards(page)).toHaveCount(12);

  await page.goto("/roadmaps?page=9");
  await expect(page).toHaveURL(/\/roadmaps\?page=2$/);
  await expect(cards(page)).toHaveCount(3);
  // A broken value is the first page; the backend never sees an invalid page.
  listCalls = [];
  await page.goto("/roadmaps?page=abc");
  await expect(cards(page)).toHaveCount(12);
  expect(listPageCalls()).toEqual([`page=1&pageSize=${pageSize}`]);
});

test("no roadmaps offers to plan the first one", async ({ page }) => {
  await open(page);
  await expect(
    page.getByRole("heading", { name: "Bạn chưa có lộ trình nào" }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: "Lập lộ trình mới" })
    .last()
    .click();
  await expect(page).toHaveURL(/\/roadmaps\/new$/);
});

test("a failed load shows the error and a retry that works", async ({
  page,
}) => {
  rows = [sample];
  await loginAs(page, "traveler");
  failures = 1;
  await page.goto("/roadmaps");
  await expect(
    page.getByRole("heading", { name: "Chưa tải được danh sách lộ trình" }),
  ).toBeVisible();
  await expect(page.locator(".alert-error")).toContainText(
    "Hiện chưa kết nối được với hệ thống.",
  );
  await expect(cards(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(cards(page)).toHaveCount(1);
});

test("the list has no horizontal overflow from 320px to 1440px", async ({
  page,
}) => {
  rows = many(9).map((row, index) =>
    index === 0
      ? {
          ...row,
          title: "Một tên lộ trình rất dài ".repeat(6),
          originLabel: "Khách sạn có một cái tên cực kỳ dài ".repeat(4),
        }
      : row,
  );
  await open(page);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${width}px`,
    ).toBe(true);
  }
  // Four roadmaps a row on a wide screen, the fifth starts the next row.
  const tops = await cards(page).evaluateAll((items) =>
    items
      .slice(0, 5)
      .map((item) => Math.round(item.getBoundingClientRect().top)),
  );
  expect(new Set(tops.slice(0, 4)).size).toBe(1);
  expect(tops[4]).toBeGreaterThan(tops[0]);
});

test("the trash button asks first, then RM-05 deletes the roadmap and the list is read again", async ({
  page,
}) => {
  rows = many(3);
  await open(page);
  const card = cards(page).filter({ hasText: "Lộ trình số 2" });
  await card
    .getByRole("button", { name: "Xóa lộ trình Lộ trình số 2" })
    .click();
  const confirm = page.getByRole("dialog", { name: "Xóa lộ trình?" });
  await expect(confirm).toContainText("“Lộ trình số 2”");
  // Keeping it sends nothing.
  await confirm.getByRole("button", { name: "Giữ lại" }).click();
  await expect(confirm).toBeHidden();
  expect(deleteCalls).toEqual([]);
  // A closed dialog keeps its column layout: while it fades out it is still displayed, and in a
  // row its text would wrap letter by letter.
  expect(
    await page
      .locator("dialog.dialog", { hasText: "Xóa lộ trình?" })
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return [
          element.hasAttribute("open"),
          style.flexDirection,
          style.overflow,
        ];
      }),
  ).toEqual([false, "column", "hidden"]);

  await card
    .getByRole("button", { name: "Xóa lộ trình Lộ trình số 2" })
    .click();
  await confirm.getByRole("button", { name: "Xóa lộ trình" }).click();
  await expect(confirm).toBeHidden();
  expect(deleteCalls).toEqual([999]);
  await expect(
    page.getByText("Đã xóa lộ trình “Lộ trình số 2”."),
  ).toBeVisible();
  await expect(cards(page)).toHaveCount(2);
  await expect(page.getByText("Bạn có 2 lộ trình")).toBeVisible();
});

test("a failed delete keeps the dialog and the card; one already gone is told", async ({
  page,
}) => {
  rows = many(2);
  await open(page);
  failDelete = { status: 503, errorCode: "SERVICE_UNAVAILABLE" };
  await page
    .getByRole("button", { name: "Xóa lộ trình Lộ trình số 1" })
    .click();
  const confirm = page.getByRole("dialog", { name: "Xóa lộ trình?" });
  await confirm.getByRole("button", { name: "Xóa lộ trình" }).click();
  await expect(confirm).toContainText("Chưa xóa được lộ trình.");
  await expect(cards(page)).toHaveCount(2);

  failDelete = { status: 404, errorCode: "ROADMAP_NOT_FOUND" };
  await confirm.getByRole("button", { name: "Xóa lộ trình" }).click();
  await expect(confirm).toBeHidden();
  await expect(
    page.getByText(
      "Lộ trình này không còn nữa (có thể đã được xóa ở nơi khác).",
    ),
  ).toBeVisible();
});
