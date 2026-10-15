import { createServer, type Server } from "node:http";
import { test, expect, type Page } from "@playwright/test";
import type {
  OwnerRestaurantDto,
  UpdateBusinessHoursRequestDto,
} from "../../src/features/owner/restaurant-types";
import { ownerRestaurantSample } from "../fixtures/owner-restaurant";

let server: Server;
let current: OwnerRestaurantDto | null;
let requests: UpdateBusinessHoursRequestDto[];
let failGet: boolean;
let delay: boolean;
let nextError: { errorCode: string; errors?: Record<string, string[]> } | null;
test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    const send = (
      status: number,
      data: unknown,
      errorCode: string | null = null,
      errors?: Record<string, string[]>,
    ) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          success: status < 400,
          message: null,
          errorCode,
          data,
          ...(errors ? { errors } : {}),
        }),
      );
    };
    if (request.url === "/api/v1/auth/login") {
      const { email } = JSON.parse(raw) as { email: string };
      send(200, {
        accessToken: "hours-test-access",
        refreshToken: "hours-test-refresh",
        accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() + 2592000000).toISOString(),
        user: {
          id: 12,
          email,
          displayName: "Chủ nhà hàng",
          avatarUrl: null,
          role: email.startsWith("traveler") ? "TRAVELER" : "RESTAURANT_OWNER",
          status: "active",
          needsPreferenceSurvey: null,
        },
      });
    } else if (
      request.url === "/api/v1/owner/restaurant" &&
      request.method === "GET"
    ) {
      if (failGet) send(503, null, "SERVICE_UNAVAILABLE");
      else
        send(
          current ? 200 : 404,
          current,
          current ? null : "RESTAURANT_NOT_FOUND",
        );
    } else if (
      request.url === "/api/v1/owner/restaurant/business-hours" &&
      request.method === "PUT"
    ) {
      const body = JSON.parse(raw) as UpdateBusinessHoursRequestDto;
      requests.push(body);
      if (delay) await new Promise((resolve) => setTimeout(resolve, 800));
      if (nextError) {
        const failure = nextError;
        nextError = null;
        send(400, null, failure.errorCode, failure.errors);
      } else if (!current) send(404, null, "RESTAURANT_NOT_FOUND");
      else {
        current = {
          ...current,
          businessHours: [...body.hours].sort(
            (a, b) =>
              a.dayOfWeek - b.dayOfWeek || a.openTime.localeCompare(b.openTime),
          ),
          isOpenNow: false,
        };
        send(200, {
          hours: current.businessHours,
          isOpenNow: current.isOpenNow,
        });
      }
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
test.beforeEach(async () => {
  current = structuredClone(ownerRestaurantSample);
  requests = [];
  failGet = false;
  delay = false;
  nextError = null;
});

const save = (page: Page) => page.locator('button[type="submit"]');
const opening = (page: Page, day = "Thứ hai", slot = 1) =>
  page.getByLabel(`Giờ mở · ${day} · khung ${slot} *`, { exact: true });
const closing = (page: Page, day = "Thứ hai", slot = 1) =>
  page.getByLabel(`Giờ đóng · ${day} · khung ${slot} *`, { exact: true });
async function login(page: Page, traveler = false) {
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill(traveler ? "traveler@hours.test" : "owner@hours.test");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(
    traveler ? /\/demo\/traveler$/ : /\/restaurant$/,
    {
      timeout: 30000,
    },
  );
  if (!traveler)
    await expect(
      page.getByRole("heading", { name: "Bạn đã có nhà hàng" }),
    ).toBeVisible();
}
async function openHours(page: Page) {
  await login(page);
  await page.goto("/restaurant/profile?tab=hours");
  await expect(opening(page)).toHaveValue("06:00");
}
async function addSlot(
  page: Page,
  day: string,
  slot: number,
  open: string,
  close: string,
) {
  await page
    .getByRole("button", { name: `Thêm khung giờ · ${day}`, exact: true })
    .click();
  await opening(page, day, slot).fill(open);
  await closing(page, day, slot).fill(close);
}

test("OWN-02 loads hours; OWN-04 PUT replaces the full week with multiple/overnight intervals", async ({
  page,
}) => {
  await openHours(page);
  await expect(save(page)).toBeDisabled();
  await addSlot(page, "Thứ hai", 2, "22:00", "02:00");
  await addSlot(page, "Thứ ba", 1, "02:00", "05:00");
  await addSlot(page, "Chủ nhật", 1, "09:00", "12:00");
  await expect(
    page.getByText("Đóng vào ngày hôm sau.", { exact: true }),
  ).toBeVisible();
  const updated = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/backend/owner/restaurant/business-hours") &&
      response.request().method() === "PUT",
  );
  await save(page).click();
  expect((await updated).status()).toBe(200);
  await expect(
    page.getByText("Đã lưu giờ mở cửa.", { exact: true }),
  ).toBeVisible();
  expect(requests).toEqual([
    {
      hours: [
        { dayOfWeek: 1, openTime: "06:00", closeTime: "13:30" },
        { dayOfWeek: 1, openTime: "22:00", closeTime: "02:00" },
        { dayOfWeek: 2, openTime: "02:00", closeTime: "05:00" },
        { dayOfWeek: 0, openTime: "09:00", closeTime: "12:00" },
      ],
    },
  ]);
  expect(current).toMatchObject({
    name: ownerRestaurantSample.name,
    operatingStatus: "open",
    verificationStatus: "verified",
    moderationStatus: "visible",
    images: ownerRestaurantSample.images,
  });
  await expect(
    page.getByText("Theo lịch đã lưu: ngoài giờ mở cửa.", { exact: true }),
  ).toBeVisible();
  await expect(save(page)).toBeDisabled();
  await page.reload();
  await expect(opening(page, "Thứ hai", 2)).toHaveValue("22:00");
  await expect(opening(page, "Chủ nhật")).toHaveValue("09:00");
});

test("local and server validation keep drafts, map indexed errors and allow retry", async ({
  page,
}) => {
  await openHours(page);
  await closing(page).fill("06:00");
  await save(page).click();
  await expect(
    page.getByText("Giờ mở và giờ đóng phải khác nhau.", { exact: true }),
  ).toBeVisible();
  await expect(closing(page)).toBeFocused();
  expect(requests).toHaveLength(0);
  await closing(page).fill("13:30");
  await addSlot(page, "Thứ hai", 2, "13:00", "17:00");
  await save(page).click();
  await expect(
    page.getByText(
      "Các khung giờ không được chồng lên nhau, kể cả qua nửa đêm.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  await opening(page, "Thứ hai", 2).fill("17:00");
  await closing(page, "Thứ hai", 2).fill("22:00");
  nextError = { errorCode: "INVALID_BUSINESS_HOURS" };
  await save(page).click();
  await expect(
    page.getByText(
      "Các khung giờ không được chồng lên nhau, kể cả qua nửa đêm.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(opening(page, "Thứ hai", 2)).toHaveValue("17:00");
  nextError = {
    errorCode: "VALIDATION_FAILED",
    errors: { "Hours[1].CloseTime": ["Giờ đóng cửa chưa hợp lệ."] },
  };
  await save(page).click();
  await expect(
    page.getByText("Giờ đóng cửa chưa hợp lệ.", { exact: true }),
  ).toBeVisible();
  await expect(closing(page, "Thứ hai", 2)).toBeFocused();
  await save(page).click();
  await expect(
    page.getByText("Đã lưu giờ mở cửa.", { exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(3);
});

test("saving blocks duplicates; modal cancellation restores the latest save and empty hours clear the week", async ({
  page,
}) => {
  const nativeDialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.type());
    await dialog.dismiss();
  });
  await openHours(page);
  await opening(page).fill("07:00");
  delay = true;
  await save(page).click();
  await expect(save(page)).toBeDisabled();
  await page.locator("form").dispatchEvent("submit");
  await expect(
    page.getByText("Đã lưu giờ mở cửa.", { exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(1);
  delay = false;
  await opening(page).fill("08:00");
  await page.getByRole("button", { name: "Hủy thay đổi", exact: true }).click();
  await page
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  await expect(opening(page)).toHaveValue("08:00");
  await page.getByRole("button", { name: "Hủy thay đổi", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Hủy thay đổi", exact: true }),
  ).toBeFocused();
  await expect(opening(page)).toHaveValue("08:00");
  await page.getByRole("button", { name: "Hủy thay đổi", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bỏ thay đổi", exact: true })
    .click();
  await expect(opening(page)).toHaveValue("07:00");
  await expect(save(page)).toBeDisabled();
  await page
    .getByRole("button", { name: "Xóa lịch tuần", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xóa lịch tuần", exact: true })
    .click();
  expect(requests).toHaveLength(1);
  await save(page).click();
  await expect(
    page.getByText("Đã lưu giờ mở cửa.", { exact: true }),
  ).toBeVisible();
  expect(requests[1]).toEqual({ hours: [] });
  await page.reload();
  await expect(
    page.getByText("Bạn chưa khai báo giờ mở cửa.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Giờ mở ·/)).toHaveCount(0);
  expect(nativeDialogs).toEqual([]);
});

test("loading errors retry without fixture fallback and missing owners can register", async ({
  page,
}) => {
  await login(page);
  failGet = true;
  await page.goto("/restaurant/profile?tab=hours");
  await expect(
    page.getByRole("heading", { name: "Chưa tải được giờ mở cửa" }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Giờ mở ·/)).toHaveCount(0);
  failGet = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(opening(page)).toHaveValue("06:00");
  current = null;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bạn chưa đăng ký nhà hàng" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Đăng ký nhà hàng", exact: true })
    .click();
  await expect(page).toHaveURL(/\/restaurant\/register$/);
});

test("route, role, origin and exact method restrictions still protect OWN-04", async ({
  page,
}) => {
  await login(page, true);
  await page.goto("/restaurant/profile?tab=hours");
  await expect(page).toHaveURL(/\/demo\/traveler$/);
  expect(
    (
      await page.request.put("/api/backend/owner/restaurant/business-hours", {
        headers: { origin: "http://localhost:3001" },
        data: { hours: [] },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.put("/api/backend/owner/restaurant/business-hours", {
        headers: { origin: "https://foreign.example" },
        data: { hours: [] },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.patch("/api/backend/owner/restaurant/business-hours", {
        headers: { origin: "http://localhost:3001" },
        data: { hours: [] },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.get("/api/backend/owner/restaurant/business-hours")
    ).status(),
  ).toBe(404);
  expect(requests).toHaveLength(0);
});

test("live profile and hours drafts require modal confirmation before switching editors", async ({
  page,
}) => {
  await openHours(page);
  await page.getByRole("tab", { name: "Thông tin", exact: true }).click();
  await page.getByLabel("Tên nhà hàng").fill("Chưa lưu");
  await page.getByRole("tab", { name: "Giờ mở cửa", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Bỏ thay đổi chưa lưu?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue("Chưa lưu");
  await page.getByRole("tab", { name: "Giờ mở cửa", exact: true }).click();
  await page
    .getByRole("button", { name: "Bỏ thay đổi và chuyển thẻ", exact: true })
    .click();
  await opening(page).fill("07:30");
  await page.getByRole("tab", { name: "Thông tin", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Bỏ thay đổi giờ mở cửa chưa lưu?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  await expect(opening(page)).toHaveValue("07:30");
  await page.getByRole("tab", { name: "Thông tin", exact: true }).click();
  await page
    .getByRole("button", { name: "Bỏ thay đổi và chuyển thẻ", exact: true })
    .click();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue(
    ownerRestaurantSample.name,
  );
  expect(requests).toHaveLength(0);
});

test("demo supports multiple slots across navigation with no live PUT and fits desktop/mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo/owner/profile?tab=hours");
  await expect(opening(page)).toHaveValue("07:00");
  await closing(page).fill("13:30");
  await addSlot(page, "Thứ hai", 2, "17:00", "22:00");
  await save(page).click();
  await expect(
    page.getByText("Đã lưu giờ mở cửa trong bản minh họa.", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/owner-hours-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/owner-hours-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("tab", { name: "Thông tin", exact: true }).click();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue("Bếp Nhà");
  await page.getByRole("tab", { name: "Giờ mở cửa", exact: true }).click();
  await expect(opening(page, "Thứ hai", 2)).toHaveValue("17:00");
  await page
    .getByRole("button", { name: "Bỏ khung giờ · Thứ hai · 2", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bỏ khung giờ", exact: true })
    .click();
  await expect(opening(page, "Thứ hai", 2)).toHaveCount(0);
  await page.getByRole("button", { name: "Hủy thay đổi", exact: true }).click();
  await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
  await expect(opening(page, "Thứ hai", 2)).toHaveValue("17:00");
  expect(requests).toHaveLength(0);
  expect(errors).toEqual([]);
});
