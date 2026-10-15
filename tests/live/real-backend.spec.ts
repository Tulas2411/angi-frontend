import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test("real BE: auth smoke, role guards, session rotation and logout", () => {
  test.setTimeout(180000);
  const output = execFileSync(process.execPath, ["scripts/smoke-test.mjs"], {
    env: { ...process.env, APP_URL: "http://localhost:3001" },
    timeout: 170000,
    windowsHide: true,
    encoding: "utf8",
  });
  console.log(output);
});

test("real BE: owner registers, edits profile, saves overnight hours and confirms removal in a modal", async ({
  page,
}) => {
  const email = process.env.ANGI_TEST_OWNER_EMAIL;
  const password = process.env.ANGI_TEST_PASSWORD;
  if (!email || !password)
    throw new Error("Seed a fresh local test owner first.");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", async (dialog) => {
    errors.push(`Unexpected native dialog: ${dialog.type()}`);
    await dialog.dismiss();
  });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/restaurant$/);
  await expect(page.getByLabel("Tên nhà hàng")).toBeVisible();
  const name = `Nhà hàng kiểm thử ${Date.now()}`;
  await page.getByLabel("Tên nhà hàng").fill(name);
  await page.getByLabel("Số điện thoại nhà hàng").fill("0901234567");
  await page.getByLabel("Địa chỉ", { exact: false }).fill("24 Nguyễn Hữu Huân");
  await page.getByLabel("Tỉnh / thành phố").fill("Thành phố Hà Nội");
  await page.getByLabel("Quận / huyện").fill("Quận Hoàn Kiếm");
  await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  const location = page.getByRole("dialog", { name: "Chọn vị trí nhà hàng" });
  await location.getByLabel("Vĩ độ").fill("21.0285");
  await location.getByLabel("Kinh độ").fill("105.8542");
  await location
    .getByRole("button", { name: "Lưu vị trí", exact: true })
    .click();
  const uploaded = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/backend/media") &&
      response.request().method() === "POST",
  );
  await page.getByLabel("Ảnh bìa", { exact: true }).setInputFiles({
    name: "angi-local-live.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  expect((await uploaded).status()).toBe(201);
  await expect(page.getByRole("button", { name: /Bỏ ảnh bìa/ })).toBeEnabled();
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/backend/owner/restaurant") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Đăng ký nhà hàng", exact: true })
    .click();
  expect((await created).status()).toBe(201);
  await expect(
    page.getByRole("heading", { name: "Đăng ký nhà hàng thành công" }),
  ).toBeVisible();
  await page.goto("/restaurant/profile");
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue(name);
  const updated = name + " đã sửa";
  await page.getByLabel("Tên nhà hàng").fill(updated);
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(
    page.getByText("Đã lưu hồ sơ nhà hàng.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue(updated);
  await page.getByRole("tab", { name: "Giờ mở cửa", exact: true }).click();
  await page
    .getByRole("button", { name: "Thêm khung giờ · Thứ hai", exact: true })
    .click();
  await page
    .getByLabel("Giờ mở · Thứ hai · khung 1 *", { exact: true })
    .fill("22:00");
  await page
    .getByLabel("Giờ đóng · Thứ hai · khung 1 *", { exact: true })
    .fill("02:00");
  await page.locator('button[type="submit"]').click();
  await expect(
    page.getByText("Đã lưu giờ mở cửa.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Giờ mở · Thứ hai · khung 1 *", { exact: true }),
  ).toHaveValue("22:00");
  const persisted = await page.request.get("/api/backend/owner/restaurant");
  expect(persisted.status()).toBe(200);
  const restaurant = (await persisted.json()).data;
  expect(restaurant.name).toBe(updated);
  expect(restaurant.businessHours).toEqual([
    { dayOfWeek: 1, openTime: "22:00", closeTime: "02:00" },
  ]);
  expect(restaurant.verificationStatus).toBe("unverified");
  expect(restaurant.coverUrl).toMatch(/^https:\/\//);
  await page
    .getByRole("button", { name: "Xóa lịch tuần", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xóa lịch tuần", exact: true })
    .click();
  await page.locator('button[type="submit"]').click();
  await expect(
    page.getByText("Đã lưu giờ mở cửa.", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Thêm khung giờ · Thứ hai", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Bạn chưa khai báo giờ mở cửa.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/live-owner-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("real BE: traveler cannot call owner mutations and tokens stay server-side", async ({
  request,
}) => {
  const login = await request.post("/api/auth/login", {
    headers: { Origin: "http://localhost:3001" },
    data: {
      email: "traveler@angi.local",
      password: process.env.ANGI_TEST_PASSWORD,
    },
  });
  expect(login.status()).toBe(200);
  const body = await login.json();
  expect(body.data.role).toBe("TRAVELER");
  expect(body.data).not.toHaveProperty("accessToken");
  expect(body.data).not.toHaveProperty("refreshToken");
  const denied = await request.put(
    "/api/backend/owner/restaurant/business-hours",
    {
      headers: { Origin: "http://localhost:3001" },
      data: { hours: [] },
    },
  );
  expect(denied.status()).toBe(403);
  expect((await denied.json()).errorCode).toBe("FORBIDDEN");
  await request.post("/api/auth/logout", {
    headers: { Origin: "http://localhost:3001" },
  });
});
