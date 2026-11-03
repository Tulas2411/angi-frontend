import { expect, test, type Page } from "@playwright/test";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";

/** F-63 View Dashboard: ADM-D1..ADM-D3 and OPS-01 against a stub shaped like the DTOs. */
let calls: string[] = [];
let missing = false;

const summary = (from: string, to: string) => ({
  from,
  to,
  users: {
    total: 1280,
    new: 64,
    byRole: { TRAVELER: 1200, RESTAURANT_OWNER: 70, MOD: 8, ADMIN: 2 },
    byStatus: { active: 1250, suspended: 20, banned: 10 },
  },
  restaurants: {
    total: 96,
    new: 7,
    byVerificationStatus: { verified: 80, pending: 10, unverified: 6 },
    byModerationStatus: { visible: 90, hidden: 6 },
  },
  queues: {
    pendingVerifications: 10,
    pendingMenus: 4,
    pendingRestaurantReports: 2,
    pendingSocialReports: 0,
  },
  content: { blogs: 30, comments: 210, reviews: 150 },
  roadmaps: { created: 120, aiGenerationJobs: 45 },
  feedback: { likes: 900, dislikes: 100 },
  outbox: { pending: 3, dead: 1 },
});

const handler: StubHandler = ({ method, url }, send) => {
  if (method !== "GET") return false;
  const parsed = new URL(url, "http://stub");
  const path = parsed.pathname;
  const query = parsed.searchParams;
  if (
    !path.startsWith("/api/v1/admin/dashboard") &&
    path !== "/api/v1/admin/outbox"
  )
    return false;
  calls.push(`${path.replace("/api/v1/admin/", "")}?${query}`);
  if (missing) {
    send(404, null, "ROUTE_NOT_FOUND");
    return true;
  }
  if (path.endsWith("/summary")) {
    send(200, summary(query.get("from") ?? "", query.get("to") ?? ""));
    return true;
  }
  if (path.endsWith("/timeseries")) {
    send(200, {
      metric: query.get("metric"),
      interval: query.get("interval"),
      points: [
        { bucket: "2026-10-01", value: 3 },
        { bucket: "2026-10-02", value: 8 },
        { bucket: "2026-10-03", value: 5 },
      ],
    });
    return true;
  }
  if (path.endsWith("/top")) {
    const type = query.get("type");
    send(200, {
      type,
      items: [
        {
          id: 105,
          name: type === "restaurants" ? "Bún Bò Bà Diệu" : "Bún bò Huế",
          score: type === "restaurants" ? 4.6 : 128,
          subtitle: type === "restaurants" ? null : "Bún Bò Bà Diệu",
        },
      ],
    });
    return true;
  }
  send(200, {
    items: [
      {
        id: 7781,
        eventUuid: "2b6f1c9e-3d4a-4f7b-8e21-9c0d5a6b7e88",
        eventType: "DISH_UPSERTED",
        aggregateKey: "dish:105",
        payload: { dish_id: 105, name: "Bún bò Huế" },
        status: query.get("status") ?? "dead",
        attemptCount: 8,
        lastError: "503 VECTOR_NOT_READY",
        createdAt: "2026-10-02T02:00:00Z",
        nextAttemptAt: null,
      },
    ],
    page: 1,
    pageSize: Number(query.get("pageSize")),
    totalItems: 1,
    totalPages: 1,
  });
  return true;
};

let stub: AccountStub;
test.beforeAll(async () => {
  stub = await startAccountStub(5164, handler);
});
test.afterAll(async () => {
  await stopAccountStub(stub);
});
test.beforeEach(() => {
  stub.reset();
  calls = [];
  missing = false;
});

async function open(page: Page, path = "/administration") {
  await loginAs(page, "admin");
  await page.goto(path);
}

test("the overview reads ADM-D1 for the last 30 days and shows the queues", async ({
  page,
}) => {
  await open(page);
  await expect(
    page.getByRole("heading", { name: "Tổng quan hệ thống", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("1.280")).toBeVisible();
  await expect(page.getByText("+64 mới trong kỳ")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Hồ sơ xác minh chờ duyệt/ }),
  ).toBeVisible();
  const first = calls.find((call) => call.startsWith("dashboard/summary"));
  expect(first).toMatch(
    /^dashboard\/summary\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/,
  );
  // 7 days asks again with the shorter range.
  await page.getByRole("button", { name: "7 ngày" }).click();
  await expect
    .poll(
      () => calls.filter((call) => call.startsWith("dashboard/summary")).length,
    )
    .toBe(2);
});

test("the trend reads ADM-D2 by day, and a table replaces the chart on request", async ({
  page,
}) => {
  await open(page);
  await expect(page.getByRole("img", { name: /Người dùng mới/ })).toBeVisible();
  expect(calls.find((call) => call.startsWith("dashboard/timeseries"))).toMatch(
    /metric=new_users&from=.*&to=.*&interval=day/,
  );
  await page.getByRole("button", { name: "Xem dạng bảng" }).click();
  await expect(page.getByRole("cell", { name: "2/10/2026" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "8" })).toBeVisible();
});

test("the top switches between dishes and restaurants (ADM-D3)", async ({
  page,
}) => {
  await open(page);
  await expect(page.getByText("128 lượt thích")).toBeVisible();
  await page.getByRole("button", { name: "Nhà hàng", exact: true }).click();
  await expect(page.getByText("4,6 ★")).toBeVisible();
  expect(calls).toContain("dashboard/top?type=restaurants&limit=10");
});

test("the sync page lists the failed outbox events and opens one (OPS-01)", async ({
  page,
}) => {
  await open(page, "/administration/sync");
  await expect(
    page.getByRole("heading", { name: "Đồng bộ dữ liệu gợi ý", level: 1 }),
  ).toBeVisible();
  expect(calls).toContain("outbox?status=dead&page=1&pageSize=20");
  await page.getByText("dish:105").click();
  await expect(page.getByText("503 VECTOR_NOT_READY")).toBeVisible();
  await page.getByRole("button", { name: "Đang chờ gửi" }).click();
  await expect
    .poll(() => calls.at(-1))
    .toBe("outbox?status=pending&page=1&pageSize=20");
});

test("a backend without the dashboard is told plainly, without sample numbers", async ({
  page,
}) => {
  missing = true;
  await open(page);
  await expect(
    page.getByText("Máy chủ chưa có chức năng thống kê này.").first(),
  ).toBeVisible();
  await expect(page.getByText("1.280")).toHaveCount(0);
});

test("the dashboard fits from 320px to 1440px", async ({ page }) => {
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
});
