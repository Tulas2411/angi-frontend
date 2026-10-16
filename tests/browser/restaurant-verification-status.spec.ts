import { createServer, type Server } from "node:http";
import { test, expect, type Page } from "@playwright/test";
import { ownerRestaurantSample } from "../fixtures/owner-restaurant";
import {
  verificationHistoryFixture,
  verificationStatusSample,
} from "../../src/mocks/verification-history";
import type { GetVerificationStatusResponseDto } from "../../src/features/owner/verification-types";
import type { RoleCode } from "../../src/features/auth/types";
import { HOME_BY_ROLE } from "../../src/features/auth/roles";

let server: Server;
let history: GetVerificationStatusResponseDto;
let getError: { status: number; errorCode: string } | null;
let delay: number;
let calls: { method: string; url: string; body: string }[];
let privateRequests: string[];

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    const send = (
      status: number,
      data: unknown,
      errorCode: string | null = null,
    ) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          success: status < 400,
          message: null,
          errorCode,
          data,
        }),
      );
    };
    if (request.url === "/api/v1/auth/login") {
      const { email } = JSON.parse(raw) as { email: string };
      const role: RoleCode = email.startsWith("traveler")
        ? "TRAVELER"
        : email.startsWith("mod")
          ? "MOD"
          : email.startsWith("admin")
            ? "ADMIN"
            : "RESTAURANT_OWNER";
      send(200, {
        accessToken: "history-local-access",
        refreshToken: "history-local-refresh",
        accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() + 2592000000).toISOString(),
        user: {
          id: 12,
          email,
          displayName: "Chủ nhà hàng",
          avatarUrl: null,
          role,
          status: "active",
          needsPreferenceSurvey: null,
        },
      });
    } else if (
      request.url === "/api/v1/owner/restaurant" &&
      request.method === "GET"
    ) {
      // Deliberately older than OWN-07: history must publish its current restaurant state.
      send(200, {
        ...ownerRestaurantSample,
        verificationStatus: "unverified",
        latestVerification: null,
      });
    } else if (
      request.url === "/api/v1/owner/restaurant/verifications" &&
      request.method === "GET"
    ) {
      calls.push({ method: request.method, url: request.url, body: raw });
      const result = structuredClone(history);
      const failure = getError;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (failure) send(failure.status, null, failure.errorCode);
      else send(200, result);
    } else send(404, null, "ROUTE_NOT_FOUND");
  });
  await new Promise<void>((resolve) =>
    server.listen(5164, "127.0.0.1", resolve),
  );
});
test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
test.beforeEach(async ({ context }) => {
  history = verificationHistoryFixture();
  getError = null;
  delay = 0;
  calls = [];
  privateRequests = [];
  await context.route("**/*", async (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === "localhost" || host === "127.0.0.1") await route.continue();
    else {
      privateRequests.push(route.request().url());
      await route.abort();
    }
  });
});
async function login(page: Page, role: RoleCode = "RESTAURANT_OWNER") {
  await page.context().clearCookies();
  await page.goto("/login");
  const name =
    role === "TRAVELER"
      ? "traveler"
      : role === "MOD"
        ? "mod"
        : role === "ADMIN"
          ? "admin"
          : "owner";
  await page.getByLabel("Email", { exact: true }).fill(`${name}@history.test`);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(HOME_BY_ROLE[role], { timeout: 30000 });
}
async function open(page: Page) {
  await login(page);
  await page.goto("/restaurant/verification?tab=status");
}
const latest = (page: Page) =>
  page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "Hồ sơ gần nhất", exact: true }),
  });
const dialog = (page: Page) => page.getByRole("dialog");

test("GET uses the workbook shape and history order; older feedback and previous attempts open in a keyboard-accessible modal", async ({
  page,
}) => {
  await open(page);
  await expect(
    page.getByRole("heading", { name: "Lịch sử hồ sơ", exact: true }),
  ).toBeVisible();
  expect(calls).toEqual([
    { method: "GET", url: "/api/v1/owner/restaurant/verifications", body: "" },
  ]);
  await expect(page.locator(".verification-history-list strong")).toHaveText([
    "Hồ sơ #23 · Mới nhất",
    "Hồ sơ #22",
    "Hồ sơ #21",
  ]);
  await expect(
    latest(page).getByText("Chưa có phản hồi.", { exact: true }),
  ).toBeVisible();
  const older = page.getByRole("button", {
    name: "Xem hồ sơ #22",
    exact: true,
  });
  await older.focus();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toHaveAccessibleName("Chi tiết hồ sơ #22");
  await expect(
    dialog(page).getByText("Bổ sung ảnh giấy phép rõ nét, đầy đủ các trang.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog(page).getByText("Bổ sung giấy ATTP", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog(page).getByText("Hoài An", { exact: true }),
  ).toBeVisible();
  await dialog(page)
    .getByRole("button", { name: "Xem hồ sơ trước #21", exact: true })
    .click();
  await expect(dialog(page)).toHaveAccessibleName("Chi tiết hồ sơ #21");
  await expect(
    dialog(page).getByText("Giấy phép đã hết hiệu lực.", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(older).toBeFocused();
  expect(privateRequests).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "artifacts/verification-status-desktop.png",
    fullPage: true,
  });
});

for (const [status, label] of [
  ["pending", "Chờ duyệt"],
  ["approved", "Đã được duyệt"],
  ["rejected", "Bị từ chối"],
  ["needs_more_info", "Cần bổ sung thông tin"],
  ["cancelled", "Đã hủy"],
] as const) {
  test(`renders ${status} separately from the restaurant state and preserves nullable review information`, async ({
    page,
  }) => {
    history = verificationHistoryFixture(status);
    await open(page);
    await expect(latest(page).getByText(label, { exact: true })).toBeVisible();
    if (history.items[0].reviewNote)
      await expect(
        latest(page).getByText(history.items[0].reviewNote, { exact: true }),
      ).toBeVisible();
    else
      await expect(
        latest(page).getByText("Chưa có phản hồi.", { exact: true }),
      ).toBeVisible();
    await page
      .getByRole("tab", { name: "Hồ sơ xác minh", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Gửi hồ sơ xác minh", exact: true }),
    ).toHaveCount(status === "cancelled" ? 1 : 0);
  });
}

test("empty history offers initial submission; 503 retries and 404 stay distinct from an empty result", async ({
  page,
}) => {
  history = { verificationStatus: "unverified", items: [] };
  await open(page);
  await expect(
    page.getByRole("heading", { name: "Chưa có hồ sơ xác minh", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Chuẩn bị hồ sơ", exact: true })
    .click();
  await expect(page.getByLabel("Tên pháp lý *", { exact: true })).toBeVisible();
  getError = { status: 503, errorCode: "SERVICE_UNAVAILABLE" };
  await page
    .getByRole("tab", { name: "Trạng thái xác minh", exact: true })
    .click();
  await expect(
    page.getByText("Hiện chưa kết nối được với hệ thống.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chưa có hồ sơ xác minh", exact: true }),
  ).toHaveCount(0);
  getError = null;
  history = structuredClone(verificationStatusSample);
  await page
    .getByRole("button", { name: "Thử lại lịch sử", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hồ sơ gần nhất", exact: true }),
  ).toBeVisible();
  getError = { status: 404, errorCode: "RESTAURANT_NOT_FOUND" };
  await page
    .getByRole("button", { name: "Tải lại lịch sử", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Bạn chưa đăng ký nhà hàng",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Đăng ký nhà hàng", exact: true }),
  ).toHaveAttribute("href", "/restaurant/register");
});

test("refresh obtains the new status and signed URLs without preloading private files or polling", async ({
  page,
}) => {
  history.items[0].documents[0].url =
    "https://example.invalid/license.pdf?sig=old";
  await open(page);
  await expect(
    latest(page).getByRole("link", {
      name: "Giấy phép kinh doanh 1",
      exact: true,
    }),
  ).toHaveAttribute("href", /sig=old$/);
  history = verificationHistoryFixture("approved");
  history.items[0].documents[0].url =
    "https://example.invalid/license.pdf?sig=new";
  await page
    .getByRole("button", { name: "Tải lại lịch sử", exact: true })
    .click();
  await expect(
    latest(page).getByText("Đã được duyệt", { exact: true }),
  ).toBeVisible();
  await expect(
    latest(page).getByRole("link", {
      name: "Giấy phép kinh doanh 1",
      exact: true,
    }),
  ).toHaveAttribute("href", /sig=new$/);
  await expect(
    page
      .locator(".verification-summary")
      .first()
      .getByText("Đã xác minh", { exact: true }),
  ).toBeVisible();
  expect(calls).toHaveLength(2);
  expect(privateRequests).toEqual([]);
});

test("a late history response cannot overwrite the editor after leaving the status tab", async ({
  page,
}) => {
  delay = 700;
  await login(page);
  const response = page.waitForResponse((value) =>
    value.url().endsWith("/api/backend/owner/restaurant/verifications"),
  );
  await page.goto("/restaurant/verification?tab=status");
  await expect(page.getByRole("status", { name: "Đang tải" })).toBeVisible();
  await page.getByRole("tab", { name: "Hồ sơ xác minh", exact: true }).click();
  await response;
  await expect(page.getByLabel("Tên pháp lý *", { exact: true })).toBeVisible();
  await expect(
    page
      .locator(".verification-summary")
      .first()
      .getByText("Chưa xác minh", { exact: true }),
  ).toBeVisible();
});

test("OWN-07 rejects anonymous and non-owner roles and keeps the route guard intact", async ({
  page,
}) => {
  const url = "/api/backend/owner/restaurant/verifications";
  expect((await page.request.get(url)).status()).toBe(401);
  for (const role of ["TRAVELER", "MOD", "ADMIN"] as const) {
    await login(page, role);
    await page.goto("/restaurant/verification?tab=status");
    await expect(page).toHaveURL(HOME_BY_ROLE[role]);
    expect((await page.request.get(url)).status()).toBe(403);
  }
  expect(calls).toHaveLength(0);
});

test("mobile history and modal show long feedback without page overflow or native dialogs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const native: string[] = [];
  page.on("dialog", async (value) => {
    native.push(value.type());
    await value.dismiss();
  });
  history = verificationHistoryFixture("needs_more_info");
  history.items[0].reviewNote = "Bổ sung tài liệu rõ nét. ".repeat(18);
  await open(page);
  await page
    .getByRole("button", { name: "Xem hồ sơ #23", exact: true })
    .click();
  await expect(dialog(page)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/verification-status-mobile.png",
    fullPage: true,
  });
  await dialog(page)
    .getByRole("button", { name: "Đóng hộp thoại", exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  expect(native).toEqual([]);
});

test("demo exposes history, decisions and feedback without calling real backend or providers", async ({
  page,
}) => {
  await page.goto("/dev/scenarios?state=owner-verification-feedback");
  await expect(
    page.getByRole("heading", { name: "Lịch sử hồ sơ", exact: true }),
  ).toBeVisible();
  await expect(
    latest(page).getByText("Cần bổ sung giấy chứng nhận an toàn thực phẩm.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tải lại lịch sử", exact: true })
    .click();
  await expect(page.locator(".verification-history-list li")).toHaveCount(3);
  expect(calls).toHaveLength(0);
  expect(privateRequests).toEqual([]);
});
