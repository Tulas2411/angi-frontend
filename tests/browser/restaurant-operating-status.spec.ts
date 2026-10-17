import { createServer, type Server } from "node:http";
import { test, expect, type Page } from "@playwright/test";
import type {
  OwnerRestaurantDto,
  UpdateOperatingStatusRequestDto,
} from "../../src/features/owner/restaurant-types";
import { ownerRestaurantSample } from "../fixtures/owner-restaurant";
import { HOME_BY_ROLE } from "../../src/features/auth/roles";
import type { RoleCode } from "../../src/features/auth/types";

let server: Server;
let current: OwnerRestaurantDto | null;
let puts: UpdateOperatingStatusRequestDto[];
let failGet: boolean;
let delay: boolean;
let nextError: {
  status: number;
  errorCode: string;
  errors?: Record<string, string[]>;
} | null;
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
      const role: RoleCode = email.startsWith("traveler")
        ? "TRAVELER"
        : email.startsWith("mod")
          ? "MOD"
          : email.startsWith("admin")
            ? "ADMIN"
            : "RESTAURANT_OWNER";
      send(200, {
        accessToken: "status-test-access",
        refreshToken: "status-test-refresh",
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
      if (failGet) send(503, null, "SERVICE_UNAVAILABLE");
      else
        send(
          current ? 200 : 404,
          current,
          current ? null : "RESTAURANT_NOT_FOUND",
        );
    } else if (
      request.url === "/api/v1/owner/restaurant/operating-status" &&
      request.method === "PUT"
    ) {
      const body = JSON.parse(raw) as UpdateOperatingStatusRequestDto;
      puts.push(body);
      if (delay) await new Promise((resolve) => setTimeout(resolve, 800));
      if (nextError) {
        const failure = nextError;
        nextError = null;
        send(failure.status, null, failure.errorCode, failure.errors);
      } else if (!current) send(404, null, "RESTAURANT_NOT_FOUND");
      else if (
        body.operatingStatus === "open" &&
        current.operatingStatus !== "open" &&
        current.moderationStatus === "suspended"
      )
        send(409, null, "RESTAURANT_SUSPENDED");
      else {
        current = { ...current, operatingStatus: body.operatingStatus };
        send(200, { operatingStatus: current.operatingStatus });
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
  puts = [];
  failGet = false;
  delay = false;
  nextError = null;
});

const selected = (page: Page) =>
  page.getByLabel("Trạng thái mới", { exact: true });
const reason = (page: Page) =>
  page.getByLabel("Lý do (không bắt buộc)", { exact: true });
const update = (page: Page) =>
  page.getByRole("button", { name: "Cập nhật trạng thái", exact: true });
const confirm = (page: Page) =>
  page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận cập nhật", exact: true });
async function login(page: Page, role: RoleCode = "RESTAURANT_OWNER") {
  const emails: Record<RoleCode, string> = {
    RESTAURANT_OWNER: "owner@status.test",
    TRAVELER: "traveler@status.test",
    MOD: "mod@status.test",
    ADMIN: "admin@status.test",
  };
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(emails[role]);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(HOME_BY_ROLE[role], { timeout: 30000 });
  if (role === "RESTAURANT_OWNER")
    await expect(
      page.getByRole("heading", { name: "Bạn đã có nhà hàng" }),
    ).toBeVisible();
}
async function openStatus(page: Page) {
  await login(page);
  await page.goto("/restaurant/profile?tab=status");
  await expect(selected(page)).toHaveValue(current?.operatingStatus ?? "open");
}

test("GET prefills all statuses; PUT follows the workbook payload only after modal confirmation", async ({
  page,
}) => {
  const native: string[] = [];
  page.on("dialog", async (dialog) => {
    native.push(dialog.type());
    await dialog.dismiss();
  });
  await openStatus(page);
  await expect(page.getByText("Đã xác minh", { exact: true })).toBeVisible();
  await expect(page.getByText("Hiển thị", { exact: true })).toBeVisible();
  await expect(update(page)).toBeDisabled();
  await reason(page).fill("  Nghỉ Tết  ");
  await expect(update(page)).toBeDisabled();
  await selected(page).selectOption("temporarily_closed");
  await update(page).click();
  await expect(
    page.getByRole("dialog", { name: "Cập nhật trạng thái hoạt động?" }),
  ).toBeVisible();
  expect(puts).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(update(page)).toBeFocused();
  await expect(reason(page)).toHaveValue("  Nghỉ Tết  ");
  await update(page).click();
  await expect(
    page.getByRole("dialog").getByText("Lý do: Nghỉ Tết", { exact: true }),
  ).toBeVisible();
  const response = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith("/api/backend/owner/restaurant/operating-status") &&
      response.request().method() === "PUT",
  );
  await confirm(page).click();
  expect((await response).status()).toBe(200);
  await expect(
    page.getByText("Đã cập nhật trạng thái hoạt động.", { exact: true }),
  ).toBeVisible();
  expect(puts).toEqual([
    { operatingStatus: "temporarily_closed", note: "Nghỉ Tết" },
  ]);
  expect(current).toEqual({
    ...ownerRestaurantSample,
    operatingStatus: "temporarily_closed",
  });
  await expect(reason(page)).toHaveValue("");
  await page.reload();
  await expect(selected(page)).toHaveValue("temporarily_closed");
  await selected(page).selectOption("permanently_closed");
  await update(page).click();
  await expect(
    page.getByRole("dialog", { name: "Xác nhận đóng cửa vĩnh viễn?" }),
  ).toBeVisible();
  await confirm(page).click();
  await expect(
    page.getByText("Đã cập nhật trạng thái hoạt động.", { exact: true }),
  ).toBeVisible();
  expect(puts[1]).toEqual({ operatingStatus: "permanently_closed" });
  expect(native).toEqual([]);
});

test("backend validation focuses fields after closing the modal, retains drafts and permits retry", async ({
  page,
}) => {
  await openStatus(page);
  await selected(page).selectOption("temporarily_closed");
  await reason(page).fill("Đang sửa chữa");
  await expect(reason(page)).toHaveAttribute("maxlength", "500");
  nextError = {
    status: 400,
    errorCode: "VALIDATION_FAILED",
    errors: { Note: ["Lý do chưa hợp lệ."] },
  };
  await update(page).click();
  await confirm(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Lý do chưa hợp lệ.", { exact: true }),
  ).toBeVisible();
  await expect(reason(page)).toBeFocused();
  await expect(reason(page)).toHaveValue("Đang sửa chữa");
  await expect(selected(page)).toHaveValue("temporarily_closed");
  expect(current?.operatingStatus).toBe("open");
  nextError = {
    status: 400,
    errorCode: "VALIDATION_FAILED",
    errors: { OperatingStatus: ["Trạng thái chưa hợp lệ."] },
  };
  await update(page).click();
  await confirm(page).click();
  await expect(
    page.getByText("Trạng thái chưa hợp lệ.", { exact: true }),
  ).toBeVisible();
  await expect(selected(page)).toBeFocused();
  await update(page).click();
  await confirm(page).click();
  await expect(
    page.getByText("Đã cập nhật trạng thái hoạt động.", { exact: true }),
  ).toBeVisible();
  expect(puts).toHaveLength(3);
});

test("pending saves prevent duplicate requests and cancellation restores the latest response", async ({
  page,
}) => {
  await openStatus(page);
  await selected(page).selectOption("temporarily_closed");
  delay = true;
  await update(page).click();
  await confirm(page).click();
  await expect(selected(page)).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Đang xử lý…", exact: true }),
  ).toBeDisabled();
  await page.locator("form").dispatchEvent("submit");
  await expect(
    page.getByText("Đã cập nhật trạng thái hoạt động.", { exact: true }),
  ).toBeVisible();
  expect(puts).toHaveLength(1);
  delay = false;
  await selected(page).selectOption("permanently_closed");
  await reason(page).fill("Chưa lưu");
  await page.getByRole("button", { name: "Hủy thay đổi", exact: true }).click();
  await page
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  await expect(reason(page)).toHaveValue("Chưa lưu");
  await page.getByRole("button", { name: "Hủy thay đổi", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bỏ thay đổi", exact: true })
    .click();
  await expect(selected(page)).toHaveValue("temporarily_closed");
  await expect(reason(page)).toHaveValue("");
  await expect(update(page)).toBeDisabled();
});

test("suspended reopening returns 409 without logging out or changing other statuses; closing still works", async ({
  page,
}) => {
  current = {
    ...ownerRestaurantSample,
    operatingStatus: "temporarily_closed",
    moderationStatus: "suspended",
  };
  await openStatus(page);
  await expect(page.getByText("Bị đình chỉ", { exact: true })).toBeVisible();
  await selected(page).selectOption("open");
  await reason(page).fill("Mở lại");
  await update(page).click();
  await confirm(page).click();
  await expect(
    page.getByText(/Nhà hàng đang bị đình chỉ nên chưa thể mở lại/),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/restaurant\/profile\?tab=status$/);
  await expect(reason(page)).toHaveValue("Mở lại");
  await expect(selected(page)).toHaveValue("open");
  expect(current.operatingStatus).toBe("temporarily_closed");
  await selected(page).selectOption("permanently_closed");
  await update(page).click();
  await confirm(page).click();
  await expect(
    page.getByText("Đã cập nhật trạng thái hoạt động.", { exact: true }),
  ).toBeVisible();
  expect(current).toMatchObject({
    operatingStatus: "permanently_closed",
    moderationStatus: "suspended",
    verificationStatus: "verified",
    businessHours: ownerRestaurantSample.businessHours,
  });
});

test("GET failures offer retry without fixtures and missing restaurants offer registration", async ({
  page,
}) => {
  await login(page);
  failGet = true;
  await page.goto("/restaurant/profile?tab=status");
  await expect(
    page.getByRole("heading", { name: "Chưa tải được trạng thái nhà hàng" }),
  ).toBeVisible();
  await expect(selected(page)).toHaveCount(0);
  failGet = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(selected(page)).toHaveValue("open");
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

test("only owners can use the route/PUT; anonymous, foreign origins and wrong methods are denied", async ({
  page,
}) => {
  const url = "/api/backend/owner/restaurant/operating-status";
  const data = { operatingStatus: "temporarily_closed" };
  expect(
    (
      await page.request.put(url, {
        headers: { origin: "http://localhost:3001" },
        data,
      })
    ).status(),
  ).toBe(401);
  for (const role of ["TRAVELER", "MOD", "ADMIN"] as const) {
    await login(page, role);
    await page.goto("/restaurant/profile?tab=status");
    await expect(page).toHaveURL(HOME_BY_ROLE[role]);
    await expect(selected(page)).toHaveCount(0);
    expect(
      (
        await page.request.put(url, {
          headers: { origin: "http://localhost:3001" },
          data,
        })
      ).status(),
    ).toBe(403);
  }
  await login(page);
  expect(
    (
      await page.request.put(url, {
        headers: { origin: "https://foreign.example" },
        data,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.patch(url, {
        headers: { origin: "http://localhost:3001" },
        data,
      })
    ).status(),
  ).toBe(404);
  expect((await page.request.get(url)).status()).toBe(404);
  expect(puts).toHaveLength(0);
});

test("profile/status dirty tab exits require modals before either editor is unmounted", async ({
  page,
}) => {
  await openStatus(page);
  await selected(page).selectOption("temporarily_closed");
  await reason(page).fill("Chưa lưu");
  await page.getByRole("tab", { name: "Thông tin", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Bỏ thay đổi trạng thái chưa lưu?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  await expect(reason(page)).toHaveValue("Chưa lưu");
  await page.getByRole("tab", { name: "Thông tin", exact: true }).click();
  await page
    .getByRole("button", { name: "Bỏ thay đổi và chuyển thẻ", exact: true })
    .click();
  await page.getByLabel("Tên nhà hàng").fill("Chưa lưu tên");
  await page.getByRole("tab", { name: "Trạng thái", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Bỏ thay đổi chưa lưu?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue("Chưa lưu tên");
  await page.getByRole("tab", { name: "Trạng thái", exact: true }).click();
  await page
    .getByRole("button", { name: "Bỏ thay đổi và chuyển thẻ", exact: true })
    .click();
  await expect(selected(page)).toHaveValue("open");
  expect(puts).toHaveLength(0);
});

test("demo preserves permanent closure across workspace tabs, supports reopening and fits desktop/mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  const native: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", async (dialog) => {
    native.push(dialog.type());
    await dialog.dismiss();
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo/owner/profile?tab=status");
  await selected(page).selectOption("permanently_closed");
  await reason(page).fill("Ngừng kinh doanh tại địa chỉ này");
  await update(page).click();
  await page.screenshot({
    path: "artifacts/owner-status-confirm-desktop.png",
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/owner-status-confirm-mobile.png",
    fullPage: false,
  });
  await confirm(page).click();
  await expect(
    page.getByText("Đã cập nhật trạng thái trong bản minh họa.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/owner-status-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/owner-status-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Tổng quan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Một ngày mới tại Bếp Nhà." }),
  ).toBeVisible();
  await expect(
    page.getByText("Đóng cửa vĩnh viễn", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Quản lý nhà hàng", exact: true })
    .click();
  await page.getByRole("tab", { name: "Giờ mở cửa", exact: true }).click();
  await expect(
    page.getByRole("listitem", { name: "Thứ hai", exact: true }),
  ).toContainText("07:00");
  await page.getByRole("tab", { name: "Trạng thái", exact: true }).click();
  await expect(selected(page)).toHaveValue("permanently_closed");
  await selected(page).selectOption("open");
  await update(page).click();
  await confirm(page).click();
  await expect(
    page.getByText("Đã cập nhật trạng thái trong bản minh họa.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(selected(page)).toHaveValue("open");
  expect(puts).toHaveLength(0);
  expect(errors).toEqual([]);
  expect(native).toEqual([]);
});
