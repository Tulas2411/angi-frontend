import { createServer, type Server } from "node:http";
import { test, expect, type Page } from "@playwright/test";
import type { OwnerRestaurantDto } from "../../src/features/owner/restaurant-types";
import { ownerRestaurantSample } from "../fixtures/owner-restaurant";

let server: Server;
let current: OwnerRestaurantDto;
test.beforeAll(async () => {
  server = createServer((request, response) => {
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
    request.resume();
    request.on("end", () => {
      if (request.url === "/api/v1/auth/login")
        send(200, {
          accessToken: "overview-test-access",
          refreshToken: "overview-test-refresh",
          accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(),
          refreshTokenExpiresAt: new Date(
            Date.now() + 2592000000,
          ).toISOString(),
          user: {
            id: 12,
            email: "owner@overview.test",
            displayName: "Chủ nhà hàng",
            avatarUrl: null,
            role: "RESTAURANT_OWNER",
            status: "active",
            needsPreferenceSurvey: null,
          },
        });
      else if (
        request.url === "/api/v1/owner/restaurant" &&
        request.method === "GET"
      )
        send(200, current);
      else send(404, null, "ROUTE_NOT_FOUND");
    });
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
test.beforeEach(() => {
  current = structuredClone(ownerRestaurantSample);
});

async function openOverview(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/^Email/).fill("owner@overview.test");
  await page.getByLabel(/^Mật khẩu/).fill("TestPassword123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/restaurant$/, { timeout: 30000 });
}

const statuses = (page: Page) =>
  page.getByRole("list", { name: "Trạng thái nhà hàng" });

test("the profile card carries the three statuses, the description and the contact details", async ({
  page,
}) => {
  current = {
    ...current,
    verificationStatus: "pending",
    operatingStatus: "temporarily_closed",
    moderationStatus: "hidden",
  };
  await openOverview(page);
  const card = page.locator(".overview-profile");
  await expect(statuses(page).getByRole("listitem")).toHaveText([
    "Chờ xác minh",
    "Tạm đóng",
    "Bị ẩn",
  ]);
  await expect(
    card.getByRole("link", { name: "Quản lý hồ sơ", exact: true }),
  ).toHaveAttribute("href", "/restaurant/profile");
  await expect(card.getByText(current.description!)).toBeVisible();
  await expect(
    card.getByRole("link", { name: current.phone! }),
  ).toHaveAttribute("href", `tel:${current.phone}`);
  await expect(
    card.getByRole("link", { name: current.email! }),
  ).toHaveAttribute("href", `mailto:${current.email}`);
  await expect(
    card.getByRole("link", { name: "facebook.com/bunbobadieu" }),
  ).toHaveAttribute("href", current.website!);
  // The separate status card is gone; the statuses live in the profile card only.
  await expect(
    page.getByRole("heading", { name: "Trạng thái nhà hàng" }),
  ).toHaveCount(0);
});

test("missing description and optional contacts fall back cleanly", async ({
  page,
}) => {
  current = { ...current, description: null, email: null, website: null };
  await openOverview(page);
  const card = page.locator(".overview-profile");
  await expect(statuses(page)).toBeVisible();
  await expect(card.getByText(/^Chưa có mô tả\./)).toBeVisible();
  await expect(card.getByText("Email", { exact: true })).toHaveCount(0);
  await expect(card.getByText("Website", { exact: true })).toHaveCount(0);
  await expect(card.getByText("Điện thoại", { exact: true })).toBeVisible();
});

test("the cover is a banner and the gallery shows the restaurant images", async ({
  page,
}) => {
  current = {
    ...current,
    images: [
      "/assets/figma/restaurant.png",
      "/assets/figma/roadmap-restaurant.png",
    ],
  };
  await openOverview(page);
  const card = page.locator(".overview-profile");
  await expect(
    card.locator(".overview-cover").getByRole("img", {
      name: `Ảnh bìa ${current.name}`,
    }),
  ).toHaveAttribute("src", current.coverUrl!);
  await expect(card.getByRole("link", { name: "Đổi ảnh bìa" })).toHaveAttribute(
    "href",
    "/restaurant/profile?tab=photos",
  );
  const gallery = card.getByRole("region", { name: "Ảnh nhà hàng" });
  const large = gallery.getByRole("img", { name: /– ảnh/ });
  await expect(large).toHaveAttribute("src", current.images[0]);
  await expect(
    gallery.getByRole("button", { name: "Xem ảnh 1" }),
  ).toHaveAttribute("aria-pressed", "true");
  await gallery.getByRole("button", { name: "Xem ảnh 2" }).click();
  await expect(large).toHaveAttribute("src", current.images[1]);
  await expect(
    gallery.getByRole("button", { name: "Xem ảnh 2" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("missing cover and gallery show placeholders with a way to add photos", async ({
  page,
}) => {
  current = { ...current, coverUrl: null, images: [] };
  await openOverview(page);
  const card = page.locator(".overview-profile");
  await expect(card.getByText("Chưa có ảnh bìa")).toBeVisible();
  await expect(
    card.getByRole("link", { name: "Thêm ảnh bìa" }),
  ).toHaveAttribute("href", "/restaurant/profile?tab=photos");
  const gallery = card.getByRole("region", { name: "Ảnh nhà hàng" });
  await expect(gallery.getByText(/^Chưa có ảnh nhà hàng\./)).toBeVisible();
  await expect(gallery.getByRole("link", { name: "Thêm ảnh" })).toBeVisible();
});

test("a long description is clamped so both columns keep the same height", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  current = {
    ...current,
    description: "Đến là đón ăn ngon rồi hẵng ra về. ".repeat(30).trim(),
  };
  await openOverview(page);
  const gallery = page.locator(".overview-gallery");
  const body = page.locator(".overview-profile-body");
  await expect(page.locator(".overview-profile-description")).toHaveAttribute(
    "title",
    current.description!,
  );
  const [left, right] = await Promise.all([
    gallery.boundingBox(),
    body.boundingBox(),
  ]);
  expect(Math.abs(left!.height - right!.height)).toBeLessThan(1);
});
