import { expect, test, type Page } from "@playwright/test";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";
import type { NotificationDto } from "../../src/features/notifications/notification-types";

/**
 * F-09 / F-10 against a local stub shaped like NOTI-01..03 (API Design v1.8, MeNotificationController):
 * the data keys are snake_case as the backend writes them. Nothing reaches a shared backend.
 */
interface Call {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}
let calls: Call[] = [];
let notifications: NotificationDto[] = [];
let failList = false;

function sample(): NotificationDto[] {
  return [
    {
      id: 503,
      type: "BLOG_COMMENTED",
      title: "Có bình luận mới",
      body: 'Nguyễn An: "Quán này ngon thật!"',
      data: { blog_id: 45 },
      readAt: null,
      createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    },
    {
      id: 502,
      type: "ROADMAP_GENERATED",
      title: "Roadmap đã được tạo xong",
      body: 'AI đã thêm 6 món vào roadmap "3 ngày ăn sập Đà Nẵng".',
      data: { roadmap_id: 88, job_id: 3 },
      readAt: null,
      createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    },
    {
      id: 501,
      type: "REPORT_RESOLVED",
      title: "Báo cáo đã được xử lý",
      body: "Bài viết đã bị ẩn.",
      data: { report_id: 9, target_id: 40, target_type: "blog" },
      readAt: "2026-10-20T03:00:00Z",
      createdAt: "2026-10-20T02:00:00Z",
    },
  ];
}

const handler: StubHandler = (request, send) => {
  const url = new URL(request.url, "http://stub");
  if (!url.pathname.startsWith("/api/v1/me/notifications")) return false;
  calls.push({
    method: request.method,
    path: url.pathname,
    query: url.searchParams,
    body: request.body,
  });
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  if (url.pathname === "/api/v1/me/notifications/unread-count") {
    send(200, { unreadCount });
    return true;
  }
  if (url.pathname === "/api/v1/me/notifications" && request.method === "GET") {
    if (failList) {
      send(503, null, "SERVICE_UNAVAILABLE");
      return true;
    }
    const isRead = url.searchParams.get("isRead");
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
    const matching = notifications.filter((item) =>
      isRead === null ? true : Boolean(item.readAt) === (isRead === "true"),
    );
    send(200, {
      items: matching.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      totalItems: matching.length,
      totalPages: Math.ceil(matching.length / pageSize),
      unreadCount,
    });
    return true;
  }
  if (
    url.pathname === "/api/v1/me/notifications/read" &&
    request.method === "POST"
  ) {
    const body = request.body as { ids?: number[]; all?: boolean };
    let updated = 0;
    for (const item of notifications)
      if (!item.readAt && (body.all || body.ids?.includes(item.id))) {
        item.readAt = new Date().toISOString();
        updated += 1;
      }
    send(200, { updated });
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
test.beforeEach(async () => {
  stub.reset();
  calls = [];
  notifications = sample();
  failList = false;
});

const bell = (page: Page) => page.locator(".notification-bell");
const rows = (page: Page) => page.locator(".notification-row");
const posts = () =>
  calls.filter((call) => call.method === "POST").map((call) => call.body);

test("guests are sent to login; every signed-in role reaches the list from the bell", async ({
  page,
}) => {
  await page.goto("/notifications");
  await expect(page).toHaveURL(/\/login/);
  await loginAs(page, "traveler");
  await expect(bell(page)).toHaveAccessibleName("Thông báo, 2 chưa đọc");
  await expect(bell(page).locator(".notification-bell-count")).toHaveText("2");
  await bell(page).click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(
    page.getByRole("heading", { name: "Thông báo", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("2 thông báo chưa đọc")).toBeVisible();
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).first()).toContainText("Có bình luận mới");
  await expect(rows(page).first()).toContainText("5 phút trước");
  await expect(rows(page).nth(2)).not.toHaveAttribute("data-unread");
  // A resolved report only informs: no link.
  await expect(rows(page).nth(2).getByRole("link")).toHaveCount(0);
  const list = calls.find((call) => call.path === "/api/v1/me/notifications");
  expect(list?.query.get("page")).toBe("1");
  expect(list?.query.get("pageSize")).toBe("20");
  expect(list?.query.has("isRead")).toBe(false);

  await loginAs(page, "owner");
  await page.goto("/notifications");
  await expect(
    page.getByRole("heading", { name: "Thông báo", level: 1 }),
  ).toBeVisible();
});

test("one row is marked read on its own and the bell recounts", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  await page.goto("/notifications");
  await page
    .getByRole("button", { name: "Đánh dấu đã đọc: Roadmap đã được tạo xong" })
    .click();
  expect(posts()).toEqual([{ ids: [502] }]);
  await expect(rows(page).nth(1)).not.toHaveAttribute("data-unread");
  await expect(page.getByText("1 thông báo chưa đọc")).toBeVisible();
  await expect(bell(page)).toHaveAccessibleName("Thông báo, 1 chưa đọc");
});

test("opening a notification marks it read and goes where it points", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  await page.goto("/notifications");
  await rows(page)
    .first()
    .getByRole("link", { name: "Có bình luận mới" })
    .click();
  await expect(page).toHaveURL(/\/guides\/45$/);
  expect(posts()).toEqual([{ ids: [503] }]);
  await page.goto("/notifications");
  await expect(
    rows(page).nth(1).getByRole("link", { name: "Roadmap đã được tạo xong" }),
  ).toHaveAttribute("href", "/roadmaps/88");
});

test("the unread tab asks for isRead=false and empties once everything is read", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  await page.goto("/notifications");
  await page.getByRole("tab", { name: "Chưa đọc" }).click();
  await expect(page).toHaveURL(/filter=unread/);
  await expect(rows(page)).toHaveCount(2);
  expect(
    calls
      .findLast((call) => call.path === "/api/v1/me/notifications")
      ?.query.get("isRead"),
  ).toBe("false");

  await page.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }).click();
  expect(posts()).toEqual([{ all: true }]);
  await expect(
    page.getByText("Đã đánh dấu 2 thông báo là đã đọc."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Không có thông báo chưa đọc" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }),
  ).toBeDisabled();
  await expect(bell(page)).toHaveAccessibleName("Thông báo, không có tin mới");
});

test("an empty inbox and a failed load are told apart, and the failure retries", async ({
  page,
}) => {
  notifications = [];
  await loginAs(page, "traveler");
  await page.goto("/notifications");
  await expect(
    page.getByRole("heading", { name: "Chưa có thông báo nào" }),
  ).toBeVisible();

  failList = true;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Chưa tải được thông báo" }),
  ).toBeVisible();
  failList = false;
  notifications = sample();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(rows(page)).toHaveCount(3);
});

test("the old workspace notification pages lead to the shared screen", async ({
  page,
}) => {
  await loginAs(page, "owner");
  await page.goto("/restaurant/notifications");
  await expect(page).toHaveURL(/:3001\/notifications$/);
  await expect(
    page.getByRole("heading", { name: "Thông báo", level: 1 }),
  ).toBeVisible();
});

test("the list fits a phone without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await loginAs(page, "traveler");
  await page.goto("/notifications");
  await expect(rows(page)).toHaveCount(3);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
