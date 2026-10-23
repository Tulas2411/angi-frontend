import { stubMapboxRendering } from "./mapbox-fixture";
import { stubWardCatalogs } from "./locations-fixture";
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
    district: request.district ?? null,
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
  await stubMapboxRendering(page);
  await stubWardCatalogs(page);
  await page.route("**/api/locations/provinces", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: null,
        errorCode: null,
        data: [{ name: "Thành phố Hà Nội", code: 1 }],
      },
    }),
  );
});

/** Signs in; owners without a restaurant then open the registration form. */
async function login(page: Page, email = "owner@test.local", openForm = true) {
  await page.goto("/login");
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Mật khẩu/).fill("TestPassword123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(
    email.startsWith("traveler") ? /\/$/ : /\/restaurant$/,
  );
  if (openForm && !email.startsWith("traveler") && !restaurant)
    await page.goto("/restaurant/register");
}
async function fill(page: Page, useWardSuggestions = true) {
  await page.getByLabel("Tên nhà hàng", { exact: false }).fill("Bếp Nhà");
  await page.getByLabel("Số điện thoại nhà hàng").fill("02438262648");
  await page.getByLabel("Địa chỉ", { exact: false }).fill("24 Nguyễn Hữu Huân");
  await page.getByLabel("Tỉnh / thành phố").fill("Thành phố Hà Nội");
  await expect(page.getByLabel("Quận / huyện")).toHaveCount(0);
  const ward = page.getByRole("combobox", { name: "Phường / xã" });
  await ward.fill(useWardSuggestions ? "ba dinh" : "Phường Ba Đình");
  if (useWardSuggestions)
    await page
      .getByRole("option", { name: "Phường Ba Đình", exact: true })
      .click();
}
async function pickLocation(page: Page) {
  await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  const dialog = page.getByRole("dialog", { name: "Chọn vị trí nhà hàng" });
  await expect(
    dialog.getByRole("button", { name: "Lưu vị trí" }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Nhập tọa độ", exact: true })
    .click();
  await dialog.getByLabel("Vĩ độ").fill("21.0285");
  await dialog.getByLabel("Kinh độ").fill("105.8542");
  await dialog.getByRole("button", { name: "Lưu vị trí", exact: true }).click();
  // The dialog's own search field also matches address labels until it has unmounted.
  await expect(page.locator("dialog[open]")).toHaveCount(0);
}

test("saving a pin prefills the street and current province/ward, replacing the previous address only in the draft", async ({
  page,
}) => {
  let reverseRequests = 0;
  await page.route(
    "https://api.mapbox.com/search/geocode/v6/reverse**",
    (route) => {
      reverseRequests++;
      const url = new URL(route.request().url());
      expect(url.searchParams.get("latitude")).toBe("21.04");
      expect(url.searchParams.get("longitude")).toBe("105.83");
      return route.fulfill({
        json: {
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [105.8301, 21.0401] },
              properties: {
                feature_type: "address",
                name: "18 Hoàng Hoa Thám",
                context: {
                  address: { name: "18 Hoàng Hoa Thám" },
                  region: { name: "Hà Nội" },
                  locality: { name: "Ngọc Hà" },
                  country: { country_code: "VN" },
                },
              },
            },
          ],
        },
      });
    },
  );
  await login(page);
  await page.getByLabel("Địa chỉ", { exact: false }).fill("Địa chỉ cũ");
  await page.getByLabel("Tỉnh / thành phố").fill("Thành phố Hà Nội");
  await page
    .getByRole("combobox", { name: "Phường / xã" })
    .fill("Phường Ba Đình");
  await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  const dialog = page.getByRole("dialog", { name: "Chọn vị trí nhà hàng" });
  await dialog
    .getByRole("button", { name: "Nhập tọa độ", exact: true })
    .click();
  await dialog.getByLabel("Vĩ độ").fill("21.04");
  await dialog.getByLabel("Kinh độ").fill("105.83");
  await dialog.getByRole("button", { name: "Lưu vị trí", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Địa chỉ", { exact: false })).toHaveValue(
    "18 Hoàng Hoa Thám",
  );
  await expect(page.getByLabel("Tỉnh / thành phố")).toHaveValue(
    "Thành phố Hà Nội",
  );
  await expect(page.getByRole("combobox", { name: "Phường / xã" })).toHaveValue(
    "Phường Ngọc Hà",
  );
  await expect(page.getByText("Đã chọn: 21.040000, 105.830000")).toBeVisible();
  expect(reverseRequests).toBe(1);
  expect(requests).toHaveLength(0);
});

test("a failed reverse lookup preserves the pin and manual address and shows an inline explanation", async ({
  page,
}) => {
  await page.route(
    "https://api.mapbox.com/search/geocode/v6/reverse**",
    (route) => route.fulfill({ status: 503 }),
  );
  await login(page);
  await page.getByLabel("Địa chỉ", { exact: false }).fill("Địa chỉ tự nhập");
  await page.getByLabel("Tỉnh / thành phố").fill("Thành phố Hà Nội");
  // Close the province suggestions, which overlay the location button.
  await page.keyboard.press("Escape");
  await pickLocation(page);
  await page.waitForTimeout(2500);
  console.log(
    "DIALOGS",
    JSON.stringify(
      await page.locator("dialog").evaluateAll((els) =>
        els.map((e) => ({
          open: (e as HTMLDialogElement).open,
          cls: e.className,
          text: (e as HTMLElement).innerText.slice(0, 120),
        })),
      ),
    ),
  );
  await expect(page.getByLabel("Địa chỉ", { exact: false })).toHaveValue(
    "Địa chỉ tự nhập",
  );
  await expect(page.getByLabel("Tỉnh / thành phố")).toHaveValue(
    "Thành phố Hà Nội",
  );
  await expect(page.getByText(/Chưa tự lấy được địa chỉ/)).toBeVisible();
  expect(requests).toHaveLength(0);
});

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
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Nhập tọa độ", exact: true })
    .click();
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
  const province = page.getByRole("combobox", { name: "Tỉnh / thành phố" });
  await province.fill("ha noi");
  await page
    .getByRole("option", { name: "Thành phố Hà Nội", exact: true })
    .click();
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
    ward: "Phường Ba Đình",
    latitude: 21.0285,
    longitude: 105.8542,
    coverMediaId: 9001,
  });
  expect(requests[0]).not.toHaveProperty("priceLevel");
  expect(requests[0]).not.toHaveProperty("district");
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
    page.getByRole("heading", { name: "Quán hiện có", level: 1 }),
  ).toBeVisible();
  await page.context().clearCookies();
  await login(page, "traveler@test.local");
  await page.goto("/restaurant/register");
  await expect(page).toHaveURL(/\/$/);
  const denied = await page.request.post("/api/backend/owner/restaurant", {
    headers: { origin: "http://localhost:3001" },
    data: {},
  });
  expect(denied.status()).toBe(403);
  expect(requests).toHaveLength(0);
});

test("map keyboard selection and explicit place search produce explicit coordinates", async ({
  page,
}) => {
  let searches = 0;
  await page.route("https://api.mapbox.com/search/searchbox/**", (route) => {
    searches++;
    const url = new URL(route.request().url());
    expect(url.searchParams.get("q")).toBe("Nhà hàng thử nghiệm");
    expect(url.searchParams.get("country")).toBe("vn");
    return route.fulfill({
      json: {
        features: [
          {
            geometry: { type: "Point", coordinates: [106.7009, 10.7769] },
            properties: {
              mapbox_id: "test-place-1",
              name: "Nhà hàng thử nghiệm",
              full_address: "1 Đường thử nghiệm, Thành phố Hồ Chí Minh",
            },
          },
        ],
      },
    });
  });
  await login(page);
  await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  const dialog = page.getByRole("dialog");
  const map = dialog.getByRole("application", {
    name: "Bản đồ chọn vị trí nhà hàng",
  });
  await expect(map).toHaveAttribute("aria-busy", "false");
  await map.locator("canvas").focus();
  await page.keyboard.press("ArrowRight");
  // Mapbox eases the keyboard pan over a few hundred ms; select the centre once it has moved.
  await expect(map).toHaveAttribute("aria-busy", "false");
  await page.waitForTimeout(600);
  await page.keyboard.press("Enter");
  await dialog
    .getByRole("button", { name: "Nhập tọa độ", exact: true })
    .click();
  expect(
    Number(await dialog.getByLabel("Kinh độ").inputValue()),
  ).toBeGreaterThan(105.8542);
  await dialog
    .getByLabel("Tìm địa chỉ hoặc địa điểm")
    .fill("Nhà hàng thử nghiệm");
  await dialog.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await dialog.getByRole("button", { name: /Nhà hàng thử nghiệm/ }).click();
  await dialog.getByRole("button", { name: "Lưu vị trí" }).click();
  await expect(page.getByText("Đã chọn: 10.776900, 106.700900")).toBeVisible();
  expect(searches).toBe(1);
});

test("map information cards close independently and keep the pin and saved coordinates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  const dialog = page.getByRole("dialog", { name: "Chọn vị trí nhà hàng" });
  const map = dialog.getByRole("application", {
    name: "Bản đồ chọn vị trí nhà hàng",
  });
  await expect(map).toHaveAttribute("aria-busy", "false");
  const mapBounds = await map.boundingBox();
  const dialogBounds = await dialog.boundingBox();
  if (!mapBounds || !dialogBounds)
    throw new Error("Map dialog must have visible bounds.");
  expect(Math.abs(mapBounds.width - dialogBounds.width)).toBeLessThan(4);
  expect(Math.abs(mapBounds.height - dialogBounds.height)).toBeLessThan(4);
  await map.click({
    position: { x: mapBounds.width * 0.7, y: mapBounds.height * 0.55 },
  });
  const pin = dialog.getByRole("button", {
    name: "Hiển thị thông tin vị trí đã chọn",
  });
  await expect(pin).toBeVisible();
  await dialog
    .getByRole("button", { name: "Nhập tọa độ", exact: true })
    .click();
  await dialog.getByLabel("Vĩ độ").fill("21.0285");
  await dialog.getByLabel("Kinh độ").fill("105.8542");
  await dialog.getByRole("button", { name: "Đóng bảng nhập tọa độ" }).click();
  const pinInfo = dialog.getByRole("region", {
    name: "Thông tin điểm trên bản đồ",
    exact: true,
  });
  const summary = dialog.getByRole("region", {
    name: "Thông tin địa điểm đã chọn",
    exact: true,
  });
  await expect(pinInfo).toContainText("21.02850° N, 105.85420° E");
  await expect(summary).toBeVisible();
  await dialog.screenshot({
    path: "artifacts/restaurant-map-live-layout-desktop.png",
  });
  await dialog
    .getByRole("button", { name: "Ẩn thông tin điểm trên bản đồ", exact: true })
    .click();
  await expect(pinInfo).toHaveCount(0);
  await expect(summary).toBeVisible();
  await expect(pin).toBeFocused();
  await dialog
    .getByRole("button", { name: "Ẩn thông tin địa điểm đã chọn", exact: true })
    .click();
  await expect(summary).toHaveCount(0);
  await expect(pin).toBeVisible();
  await dialog.getByRole("button", { name: "Phóng to bản đồ" }).click();
  await expect(pinInfo).toHaveCount(0);
  await expect(summary).toHaveCount(0);
  await pin.click();
  await expect(pinInfo).toContainText("21.02850° N, 105.85420° E");
  await expect(summary).toBeVisible();
  await dialog
    .getByRole("button", { name: "Ẩn thông tin điểm trên bản đồ", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Ẩn thông tin địa điểm đã chọn", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Lưu vị trí", exact: true }).click();
  await expect(page.getByText("Đã chọn: 21.028500, 105.854200")).toBeVisible();
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
  await fill(page, false);
  await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  await expect(page.getByText(/Không tải được bản đồ/)).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Đóng hộp thoại", exact: true })
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
