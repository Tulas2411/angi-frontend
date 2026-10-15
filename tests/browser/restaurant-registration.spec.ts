import { createServer, type Server } from "node:http";
import { test, expect, type Page } from "@playwright/test";
import type {
  RegisterRestaurantRequestDto,
  OwnerRestaurantDto,
} from "../../src/features/owner/restaurant-types";

let server: Server;
let restaurant: OwnerRestaurantDto | null;
let failNext = false;
let conflictNext = false;
let requests: RegisterRestaurantRequestDto[];
let uploads: { type: string; body: string }[];
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8FYAAAAASUVORK5CYII=",
  "base64",
);

function response(request: RegisterRestaurantRequestDto): OwnerRestaurantDto {
  return {
    id: 7,
    name: request.name,
    slug: "bep-nha",
    addressLine: request.addressLine,
    provinceName: request.provinceName,
    district: request.district,
    ward: request.ward ?? null,
    latitude: request.latitude,
    longitude: request.longitude,
    phone: request.phone,
    description: request.description ?? null,
    email: request.email ?? null,
    website: request.website ?? null,
    coverUrl: null,
    images: [],
    businessHours: [],
    priceLevel: request.priceLevel ?? null,
    verificationStatus: "unverified",
    operatingStatus: "open",
    moderationStatus: "visible",
    ratingAvg: 0,
    ratingCount: 0,
    isOpenNow: false,
    distanceKm: null,
    menu: null,
    myReview: null,
    latestVerification: null,
    openMenuSubmission: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test.beforeAll(async () => {
  server = createServer(async (request, result) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    function send(
      status: number,
      data: unknown,
      errorCode: string | null = null,
      errors?: Record<string, string[]>,
    ) {
      result.writeHead(status, { "Content-Type": "application/json" });
      result.end(
        JSON.stringify({
          success: status < 400,
          message: errorCode ? "Test error" : null,
          errorCode,
          data,
          ...(errors ? { errors } : {}),
        }),
      );
    }
    if (request.url === "/api/v1/auth/login") {
      const { email } = JSON.parse(raw) as { email: string };
      send(200, {
        accessToken: "test-access",
        refreshToken: "test-refresh",
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
      send(
        restaurant ? 200 : 404,
        restaurant,
        restaurant ? null : "RESTAURANT_NOT_FOUND",
      );
    } else if (
      request.url === "/api/v1/owner/restaurant" &&
      request.method === "POST"
    ) {
      const body = JSON.parse(raw) as RegisterRestaurantRequestDto;
      requests.push(body);
      if (conflictNext) {
        conflictNext = false;
        send(409, null, "OWNER_ALREADY_HAS_RESTAURANT");
      } else if (failNext) {
        failNext = false;
        send(400, null, "VALIDATION_FAILED", {
          Name: ["Tên nhà hàng chưa hợp lệ."],
          PriceLevel: ["Vui lòng kiểm tra mức giá."],
        });
      } else {
        restaurant = response(body);
        send(201, restaurant);
      }
    } else if (request.url === "/api/v1/media" && request.method === "POST") {
      uploads.push({ type: request.headers["content-type"] ?? "", body: raw });
      send(201, {
        id: 9000 + uploads.length,
        url: "/assets/figma/TheHucBridge.svg",
        mimeType: "image/png",
        sizeBytes: 68,
        purpose: "restaurant",
        createdAt: new Date().toISOString(),
      });
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
test.beforeEach(async ({ page }) => {
  restaurant = null;
  failNext = false;
  conflictNext = false;
  requests = [];
  uploads = [];
  await page.route("https://api.mapbox.com/**", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.route("**/api/locations/provinces", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: null,
        errorCode: null,
        data: [{ name: "Thành phố Hà Nội" }],
      },
    }),
  );
});

async function login(page: Page, email = "owner@test.local") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(
    email.startsWith("traveler") ? /\/demo\/traveler$/ : /\/restaurant$/,
  );
}
async function fill(page: Page) {
  await page.getByLabel("Tên nhà hàng", { exact: false }).fill("Bếp Nhà");
  await page.getByLabel("Số điện thoại nhà hàng").fill("02438262648");
  await page.getByLabel("Địa chỉ", { exact: false }).fill("24 Nguyễn Hữu Huân");
  await page.getByLabel("Tỉnh / thành phố").fill("Thành phố Hà Nội");
  await page.getByLabel("Quận / huyện").fill("Quận Hoàn Kiếm");
}
async function pickLocation(page: Page) {
  await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  const dialog = page.getByRole("dialog", { name: "Chọn vị trí nhà hàng" });
  await expect(
    dialog.getByRole("button", { name: "Lưu vị trí" }),
  ).toBeDisabled();
  await dialog.getByLabel("Vĩ độ").fill("21.0285");
  await dialog.getByLabel("Kinh độ").fill("105.8542");
  await dialog.getByRole("button", { name: "Lưu vị trí", exact: true }).click();
}

test("required fields and explicit location prevent accidental registration", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await page
    .getByRole("button", { name: "Đăng ký nhà hàng", exact: true })
    .click();
  await expect(page.getByText("Tên nhà hàng là bắt buộc.")).toBeVisible();
  await expect(
    page.getByText("Chọn vị trí nhà hàng hoặc nhập tọa độ hợp lệ."),
  ).toBeVisible();
  await expect(page.getByLabel("Tên nhà hàng")).toBeFocused();
  expect(requests).toHaveLength(0);
  await fill(page);
  await pickLocation(page);
  await expect(page.getByText("Đã chọn: 21.028500, 105.854200")).toBeVisible();
  const opener = page.getByRole("button", { name: "Chọn vị trí trên bản đồ" });
  await opener.click();
  await page.getByRole("dialog").getByLabel("Vĩ độ").fill("22");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(page.getByText("Đã chọn: 21.028500, 105.854200")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/owner-register-desktop.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("multipart media and a numeric OWN-01 request preserve 201 and produce unverified onboarding", async ({
  page,
}) => {
  await login(page);
  await fill(page);
  await pickLocation(page);
  const mediaResponse = page.waitForResponse(
    (res) =>
      res.url().endsWith("/api/backend/media") &&
      res.request().method() === "POST",
  );
  await page
    .getByLabel("Ảnh bìa", { exact: true })
    .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
  expect((await mediaResponse).status()).toBe(201);
  await expect(page.getByRole("button", { name: /Bỏ ảnh bìa/ })).toBeEnabled();
  const registered = page.waitForResponse(
    (res) =>
      res.url().endsWith("/api/backend/owner/restaurant") &&
      res.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Đăng ký nhà hàng", exact: true })
    .click();
  expect((await registered).status()).toBe(201);
  await expect(
    page.getByRole("heading", { name: "Đăng ký nhà hàng thành công" }),
  ).toBeVisible();
  await expect(page.getByText("Chưa xác minh", { exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    name: "Bếp Nhà",
    provinceName: "Thành phố Hà Nội",
    latitude: 21.0285,
    longitude: 105.8542,
    coverMediaId: 9001,
  });
  expect(requests[0]).not.toHaveProperty("priceLevel");
  expect(uploads[0].type).toMatch(/^multipart\/form-data; boundary=/);
  expect(uploads[0].body).toContain('name="purpose"');
  expect(uploads[0].body).toContain("restaurant");
});

test("server validation preserves input and permits a successful retry", async ({
  page,
}) => {
  failNext = true;
  await login(page);
  await fill(page);
  await pickLocation(page);
  await page
    .getByRole("button", { name: "Đăng ký nhà hàng", exact: true })
    .click();
  await expect(page.getByText("Tên nhà hàng chưa hợp lệ.")).toBeVisible();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue("Bếp Nhà");
  await expect(page.getByLabel("Tên nhà hàng")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Mức giá (không bắt buộc)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByText("Vui lòng kiểm tra mức giá.")).toBeVisible();
  await page
    .getByRole("button", { name: "Đăng ký nhà hàng", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Đăng ký nhà hàng thành công" }),
  ).toBeVisible();
  expect(requests).toHaveLength(2);
});

test("a registration conflict stops further submissions", async ({ page }) => {
  conflictNext = true;
  await login(page);
  await fill(page);
  await pickLocation(page);
  await page
    .getByRole("button", { name: "Đăng ký nhà hàng", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bạn đã có nhà hàng" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Đăng ký nhà hàng", exact: true }),
  ).toHaveCount(0);
  expect(requests).toHaveLength(1);
});

test("existing owners and non-owner sessions cannot register another restaurant", async ({
  page,
}) => {
  restaurant = response({
    name: "Quán hiện có",
    phone: "02438262648",
    addressLine: "24 Nguyễn Hữu Huân",
    district: "Quận Hoàn Kiếm",
    provinceName: "Thành phố Hà Nội",
    latitude: 21.0285,
    longitude: 105.8542,
  });
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Bạn đã có nhà hàng" }),
  ).toBeVisible();
  await page.context().clearCookies();
  await login(page, "traveler@test.local");
  await page.goto("/restaurant/register");
  await expect(page).toHaveURL(/\/demo\/traveler$/);
  const denied = await page.request.post("/api/backend/owner/restaurant", {
    headers: { origin: "http://localhost:3001" },
    data: {},
  });
  expect(denied.status()).toBe(403);
  expect(requests).toHaveLength(0);
});

test("demo registration is isolated and responsive", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/scenarios?state=owner-register-restaurant");
  await fill(page);
  await page.getByLabel("Tên nhà hàng").fill("Quán thử nghiệm ANGI");
  await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/owner-register-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Đăng ký nhà hàng", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Đăng ký nhà hàng thành công" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Quán thử nghiệm ANGI" }),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  expect(uploads).toHaveLength(0);
  expect(pageErrors).toEqual([]);
});

test("cancellation uses a modal, preserves input when dismissed and returns only after confirmation", async ({
  page,
}) => {
  const nativeDialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.type());
    await dialog.dismiss();
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo");
  await page.goto("/dev/scenarios?state=owner-register-restaurant");
  await fill(page);
  await page.getByLabel("Ảnh bìa", { exact: true }).setInputFiles({
    name: "cover.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.getByRole("button", { name: /Bỏ ảnh bìa/ })).toBeVisible();
  const cancel = page.getByRole("button", { name: "Hủy", exact: true });
  const modal = page.getByRole("dialog", { name: "Hủy đăng ký nhà hàng?" });
  await cancel.click();
  await expect(modal).toBeVisible();
  await page.screenshot({ path: "artifacts/owner-cancel-modal-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/owner-cancel-modal-mobile.png" });
  await modal
    .getByRole("button", { name: "Tiếp tục đăng ký", exact: true })
    .click();
  await expect(modal).toBeHidden();
  await expect(cancel).toBeFocused();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue("Bếp Nhà");
  await expect(page.getByRole("button", { name: /Bỏ ảnh bìa/ })).toBeVisible();
  await cancel.click();
  await expect(modal).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(cancel).toBeFocused();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue("Bếp Nhà");
  await cancel.click();
  await modal.getByRole("button", { name: "Hủy đăng ký", exact: true }).click();
  await expect(page).toHaveURL(/\/demo$/);
  expect(nativeDialogs).toEqual([]);
  expect(requests).toHaveLength(0);
});

test("map keyboard selection and permanent address search produce explicit coordinates", async ({
  page,
}) => {
  await page.route("https://api.mapbox.com/search/geocode/**", (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("permanent")).toBe("true");
    return route.fulfill({
      json: {
        features: [
          {
            geometry: { coordinates: [106.7009, 10.7769] },
            properties: { full_address: "Nhà hàng thử nghiệm" },
          },
        ],
      },
    });
  });
  await login(page);
  await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  const dialog = page.getByRole("dialog");
  const map = dialog.getByRole("button", {
    name: "Bản đồ chọn vị trí nhà hàng",
  });
  await map.focus();
  await page.keyboard.press("ArrowRight");
  expect(
    Number(await dialog.getByLabel("Kinh độ").inputValue()),
  ).toBeGreaterThan(105.8542);
  await dialog
    .getByLabel("Tìm địa chỉ hoặc địa điểm")
    .fill("Nhà hàng thử nghiệm");
  await dialog.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Nhà hàng thử nghiệm", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Lưu vị trí" }).click();
  await expect(page.getByText("Đã chọn: 10.776900, 106.700900")).toBeVisible();
});

test("failed catalog and map retain manual entry; malformed uploads and foreign origins are denied", async ({
  page,
}) => {
  await page.route("**/api/locations/provinces", (route) =>
    route.fulfill({
      status: 503,
      json: {
        success: false,
        errorCode: "SERVICE_UNAVAILABLE",
        message: "Unavailable",
        data: null,
      },
    }),
  );
  await page.route("https://api.mapbox.com/**", (route) => route.abort());
  await login(page);
  await expect(page.getByText(/Chưa tải được gợi ý/)).toBeVisible();
  await fill(page);
  await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  await expect(page.getByText(/Không tải được bản đồ/)).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Hủy", exact: true })
    .click();
  const malformed = await page.request.post("/api/backend/media", {
    headers: { origin: "http://localhost:3001" },
    data: {},
  });
  expect(malformed.status()).toBe(400);
  const foreign = await page.request.post("/api/backend/owner/restaurant", {
    headers: { origin: "https://foreign.example" },
    data: {},
  });
  expect(foreign.status()).toBe(403);
  expect(requests).toHaveLength(0);
  expect(uploads).toHaveLength(0);
});
