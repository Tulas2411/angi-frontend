import { stubMapboxRendering } from "./mapbox-fixture";
import { stubWardCatalogs } from "./locations-fixture";
import { createServer, type Server } from "node:http";
import { test, expect, type Page } from "@playwright/test";
import type {
  OwnerRestaurantDto,
  UpdateRestaurantRequestDto,
} from "../../src/features/owner/restaurant-types";
import { ownerRestaurantSample } from "../fixtures/owner-restaurant";

let server: Server;
let current: OwnerRestaurantDto | null;
let patches: UpdateRestaurantRequestDto[];
let failGet = false;
let failPatch = false;
let delayPatch = false;
let uploads: number;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8FYAAAAASUVORK5CYII=",
  "base64",
);

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
          message: errorCode ? "Test error" : null,
          errorCode,
          data,
          ...(errors ? { errors } : {}),
        }),
      );
    };
    if (request.url === "/api/v1/auth/login") {
      const { email } = JSON.parse(raw) as { email: string };
      send(200, {
        accessToken: "profile-test-access",
        refreshToken: "profile-test-refresh",
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
      if (failGet) {
        send(503, null, "SERVICE_UNAVAILABLE");
      } else
        send(
          current ? 200 : 404,
          current,
          current ? null : "RESTAURANT_NOT_FOUND",
        );
    } else if (
      request.url === "/api/v1/owner/restaurant" &&
      request.method === "PATCH"
    ) {
      const patch = JSON.parse(raw) as UpdateRestaurantRequestDto;
      patches.push(patch);
      if (delayPatch) await new Promise((resolve) => setTimeout(resolve, 600));
      if (failPatch) {
        failPatch = false;
        send(400, null, "VALIDATION_FAILED", {
          Name: ["Tên nhà hàng chưa hợp lệ."],
        });
      } else if (!current) send(404, null, "RESTAURANT_NOT_FOUND");
      else {
        const { coverMediaId, imageMediaIds, ...fields } = patch;
        current = { ...current, ...fields, updatedAt: "2026-10-14T02:00:00Z" };
        if (patch.name) current.name = patch.name.trim();
        if (coverMediaId !== undefined)
          current.coverUrl =
            coverMediaId === null
              ? null
              : "/assets/figma/roadmap-restaurant.png";
        if (imageMediaIds !== undefined)
          current.images = imageMediaIds.map(
            () => "/assets/figma/roadmap-restaurant.png",
          );
        send(200, current);
      }
    } else if (request.url === "/api/v1/media" && request.method === "POST") {
      uploads++;
      send(201, {
        id: 9000 + uploads,
        url: "/assets/figma/roadmap-restaurant.png",
        mimeType: "image/png",
        sizeBytes: png.length,
        purpose: "restaurant",
        createdAt: "2026-10-14T02:00:00Z",
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
  current = structuredClone(ownerRestaurantSample);
  patches = [];
  failGet = false;
  failPatch = false;
  delayPatch = false;
  uploads = 0;
  await stubMapboxRendering(page);
  await stubWardCatalogs(page);
  await page.route("**/api/locations/provinces", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: null,
        errorCode: null,
        data: [{ name: "Thành phố Đà Nẵng", code: 48 }],
      },
    }),
  );
});
async function login(page: Page, traveler = false) {
  await page.goto("/login");
  await page
    .getByLabel(/^Email/)
    .fill(traveler ? "traveler@profile.test" : "owner@profile.test");
  await page.getByLabel(/^Mật khẩu/).fill("TestPassword123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(traveler ? /\/$/ : /\/restaurant$/, {
    timeout: 30000,
  });
  if (!traveler)
    await expect(page.locator("main h1")).toBeVisible({ timeout: 30000 });
}
async function openProfile(page: Page) {
  await login(page);
  await page.goto("/restaurant/profile");
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue(
    ownerRestaurantSample.name,
  );
}
const save = (page: Page) =>
  page.getByRole("button", { name: "Lưu thay đổi", exact: true });

test("GET loads the owner profile; PATCH sends only edited values and preserves read-only data", async ({
  page,
}) => {
  await openProfile(page);
  await expect(page.getByLabel("Mức giá (không bắt buộc)")).toHaveValue("1");
  await expect(page.getByLabel("Phường / xã")).toHaveValue("Phường Hải Châu 1");
  await expect(save(page)).toBeDisabled();
  await page.getByLabel("Tên nhà hàng").fill("  Bún Bò Bà Diệu - Lê Duẩn  ");
  await page.getByLabel("Email nhà hàng").fill("");
  const updated = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/backend/owner/restaurant") &&
      response.request().method() === "PATCH",
  );
  await save(page).click();
  expect((await updated).status()).toBe(200);
  await expect(
    page.getByText("Đã lưu hồ sơ nhà hàng.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue(
    "Bún Bò Bà Diệu - Lê Duẩn",
  );
  expect(patches).toEqual([{ name: "Bún Bò Bà Diệu - Lê Duẩn", email: null }]);
  expect(current).toMatchObject({
    verificationStatus: "verified",
    moderationStatus: "visible",
    businessHours: ownerRestaurantSample.businessHours,
    openMenuSubmission: ownerRestaurantSample.openMenuSubmission,
    images: ownerRestaurantSample.images,
  });
  await page.reload();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue(
    "Bún Bò Bà Diệu - Lê Duẩn",
  );
});

test("local and backend validation retain drafts, focus the invalid field and allow retry", async ({
  page,
}) => {
  await openProfile(page);
  await page.getByLabel("Tên nhà hàng").fill("");
  await page.getByLabel("Số điện thoại nhà hàng").fill("");
  await save(page).click();
  await expect(
    page.getByText("Tên nhà hàng không được để trống."),
  ).toBeVisible();
  expect(patches).toHaveLength(0);
  failPatch = true;
  await page.getByLabel("Tên nhà hàng").fill("Quán mới");
  await expect(page.getByLabel("Tên nhà hàng")).toBeFocused();
  await page
    .getByLabel("Số điện thoại nhà hàng")
    .fill(ownerRestaurantSample.phone ?? "");
  await save(page).click();
  await expect(page.getByText("Tên nhà hàng chưa hợp lệ.")).toBeVisible();
  await expect(page.getByLabel("Tên nhà hàng")).toBeFocused();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue("Quán mới");
  await save(page).click();
  await expect(
    page.getByText("Đã lưu hồ sơ nhà hàng.", { exact: true }),
  ).toBeVisible();
  expect(patches).toHaveLength(2);
});

test("province choices preserve unchanged profile values and PATCH the selected official name", async ({
  page,
}) => {
  await page.route("**/api/locations/provinces", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          { name: "Thành phố Đà Nẵng", code: 48 },
          { name: "Tỉnh Điện Biên", code: 11 },
        ],
      },
    }),
  );
  await openProfile(page);
  const province = page.getByRole("combobox", { name: "Tỉnh / thành phố" });
  await province.fill("da nang");
  await page
    .getByRole("option", { name: "Thành phố Đà Nẵng", exact: true })
    .click();
  await expect(save(page)).toBeDisabled();
  await province.fill("dien bien");
  await page
    .getByRole("option", { name: "Tỉnh Điện Biên", exact: true })
    .click();
  await expect(page.getByLabel("Quận / huyện")).toHaveCount(0);
  await page.getByLabel("Phường / xã").fill("");
  await save(page).click();
  await expect(save(page)).toBeDisabled();
  expect(patches).toEqual([
    { provinceName: "Tỉnh Điện Biên", district: null, ward: null },
  ]);
  expect(current?.provinceName).toBe("Tỉnh Điện Biên");
});

test("saving disables duplicate submission and cancellation restores the latest saved response", async ({
  page,
}) => {
  await openProfile(page);
  delayPatch = true;
  await page.getByLabel("Tên nhà hàng").fill("Tên đã lưu");
  await save(page).click();
  await expect(
    page.getByRole("button", { name: "Đang xử lý…", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Hủy thay đổi", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Đã lưu hồ sơ nhà hàng.", { exact: true }),
  ).toBeVisible();
  expect(patches).toHaveLength(1);
  await page.getByLabel("Tên nhà hàng").fill("Bản chưa lưu");
  await page.getByRole("button", { name: "Hủy thay đổi", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Bỏ thay đổi chưa lưu?" });
  await modal
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue("Bản chưa lưu");
  await page.getByRole("button", { name: "Hủy thay đổi", exact: true }).click();
  await modal.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue("Tên đã lưu");
  await expect(save(page)).toBeDisabled();
  expect(patches).toHaveLength(1);
});

test("cover removal and full gallery replacement use explicit null and numeric uploaded IDs", async ({
  page,
}) => {
  await openProfile(page);
  await page.getByRole("tab", { name: "Hình ảnh", exact: true }).click();
  await page
    .getByRole("button", { name: "Bỏ ảnh bìa hiện tại", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bỏ ảnh bìa", exact: true })
    .click();
  expect(patches).toHaveLength(0);
  await save(page).click();
  await expect(
    page.getByText("Đã lưu hồ sơ nhà hàng.", { exact: true }),
  ).toBeVisible();
  expect(patches[0]).toEqual({ coverMediaId: null });
  await page
    .getByRole("button", { name: "Thay thư viện ảnh", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Chọn ảnh thay thế", exact: true })
    .click();
  await expect(save(page)).toBeDisabled();
  await page
    .getByLabel("Ảnh nhà hàng mới", { exact: true })
    .setInputFiles({ name: "new.png", mimeType: "image/png", buffer: png });
  await expect(
    page.getByRole("button", { name: /Bỏ ảnh nhà hàng mới/ }),
  ).toBeEnabled();
  await save(page).click();
  await expect(
    page.getByText("Đã lưu hồ sơ nhà hàng.", { exact: true }),
  ).toBeVisible();
  expect(patches[1]).toEqual({ imageMediaIds: [9001] });
  await page
    .getByRole("button", { name: "Xóa toàn bộ ảnh", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xóa toàn bộ ảnh", exact: true })
    .click();
  await save(page).click();
  await expect(
    page.getByText("Đã lưu hồ sơ nhà hàng.", { exact: true }),
  ).toBeVisible();
  expect(patches[2]).toEqual({ imageMediaIds: [] });
});

test("live load errors offer retry without fixtures; missing owners can go to registration", async ({
  page,
}) => {
  await login(page);
  failGet = true;
  await page.goto("/restaurant/profile");
  await expect(
    page.getByRole("heading", { name: "Chưa tải được hồ sơ nhà hàng" }),
  ).toBeVisible();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveCount(0);
  failGet = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue(
    ownerRestaurantSample.name,
  );
  current = null;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bạn chưa đăng ký nhà hàng" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Đăng ký nhà hàng", exact: true })
    .click();
  await expect(page).toHaveURL(/\/restaurant\/register$/);
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue("");
});

test("non-owner routes, PATCH and foreign mutation origins remain denied", async ({
  page,
}) => {
  await login(page, true);
  await page.goto("/restaurant/profile");
  await expect(page).toHaveURL(/\/$/);
  expect(
    (
      await page.request.patch("/api/backend/owner/restaurant", {
        headers: { origin: "http://localhost:3001" },
        data: { name: "Forbidden" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await page.request.get("/api/backend/owner/restaurant")).status(),
  ).toBe(403);
  expect(
    (
      await page.request.patch("/api/backend/owner/restaurant", {
        headers: { origin: "https://foreign.example" },
        data: { name: "Forbidden" },
      })
    ).status(),
  ).toBe(403);
  expect(patches).toHaveLength(0);
});

test("Mapbox location selection stages numeric coordinates until the owner saves the profile", async ({
  page,
}) => {
  await openProfile(page);
  await page
    .getByRole("button", { name: "Chọn vị trí trên bản đồ", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Chọn vị trí nhà hàng" });
  await expect(
    dialog.getByRole("application", {
      name: "Bản đồ chọn vị trí nhà hàng",
      exact: true,
    }),
  ).toHaveAttribute("aria-busy", "false");
  await dialog
    .getByRole("button", { name: "Nhập tọa độ", exact: true })
    .click();
  await dialog.getByLabel("Vĩ độ").fill("10.7769");
  await dialog.getByLabel("Kinh độ").fill("106.7009");
  await dialog.getByRole("button", { name: "Lưu vị trí", exact: true }).click();
  expect(patches).toHaveLength(0);
  await save(page).click();
  await expect(save(page)).toBeDisabled();
  await expect
    .poll(() => patches)
    .toEqual([{ latitude: 10.7769, longitude: 106.7009 }]);
});
