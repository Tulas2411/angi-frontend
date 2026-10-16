import { test, expect, type Page } from "@playwright/test";
import type {
  OwnerRestaurantDto,
  BusinessHourDto,
} from "../../src/features/owner/restaurant-types";

const origin = "http://localhost:3001";
const latest = process.env.ANGI_TEST_SOURCE_REF === "dev";
const prefix = latest ? "dev" : "working";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=",
  "base64",
);
const image = (name: string) => ({ name, mimeType: "image/png", buffer: png });
const ownerEmail = (kind: string) => {
  const key =
    kind === "register"
      ? "ANGI_TEST_OWNER_EMAIL"
      : `ANGI_TEST_${kind.toUpperCase()}_OWNER_EMAIL`;
  const value = process.env[key];
  if (!value) throw new Error(`Prepare the local owner task accounts: ${key}`);
  return value;
};
async function login(page: Page, email: string) {
  const result = await page.request.post("/api/auth/login", {
    headers: { Origin: origin },
    data: { email, password: process.env.ANGI_TEST_PASSWORD },
  });
  expect(result.status(), "Real backend login").toBe(200);
}
async function mutate(
  page: Page,
  path: string,
  method: string,
  data: object,
  status = 200,
  code?: string,
) {
  const result = await page.request.fetch(`/api/backend/${path}`, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(result.status(), `${method} ${path}`).toBe(status);
  const body = await result.json();
  if (code) expect(body.errorCode).toBe(code);
  return body;
}
async function saved(page: Page): Promise<OwnerRestaurantDto> {
  const result = await page.request.get("/api/backend/owner/restaurant");
  expect(result.status()).toBe(200);
  return (await result.json()).data;
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
  await page
    .getByLabel(`Giờ mở · ${day} · khung ${slot} *`, { exact: true })
    .fill(open);
  await page
    .getByLabel(`Giờ đóng · ${day} · khung ${slot} *`, { exact: true })
    .fill(close);
}
async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `artifacts/owner-${prefix}-${name}.png`,
    fullPage: true,
  });
}
test.beforeEach(async ({ page }) => {
  page.on("dialog", async (dialog) => {
    await dialog.dismiss();
    throw new Error(`Native ${dialog.type()} is forbidden; use a modal.`);
  });
});

test("ANGI-36: required fields, media limits, real image uploads, registration and duplicate protection", async ({
  page,
}) => {
  await login(page, ownerEmail("register"));
  await page.goto("/restaurant");
  await expect(page.getByLabel("Tên nhà hàng")).toBeVisible();
  let submissions = 0;
  let uploads = 0;
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    if (request.url().endsWith("/api/backend/owner/restaurant")) submissions++;
    if (request.url().endsWith("/api/backend/media")) uploads++;
  });
  await test.step("Required fields and location block invalid submission", async () => {
    await page
      .getByRole("button", { name: "Đăng ký nhà hàng", exact: true })
      .click();
    await expect(
      page.getByText("Tên nhà hàng là bắt buộc.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Chọn vị trí nhà hàng hoặc nhập tọa độ hợp lệ.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(submissions).toBe(0);
  });
  await test.step("File type, 5 MiB size and 10-image limit are validated before upload", async () => {
    await page.getByLabel("Ảnh bìa", { exact: true }).setInputFiles({
      name: "invalid.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF"),
    });
    await expect(
      page.getByText("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Ảnh bìa", { exact: true }).setInputFiles({
      name: "large.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    });
    await expect(
      page
        .getByText(/5 MB/)
        .filter({ hasText: /Ảnh|ảnh/ })
        .last(),
    ).toBeVisible();
    await page
      .getByLabel("Ảnh nhà hàng", { exact: true })
      .setInputFiles(
        Array.from({ length: 11 }, (_, i) => image(`too-many-${i}.png`)),
      );
    await expect(
      page.getByText("Chỉ được chọn tối đa 10 ảnh.", { exact: true }),
    ).toBeVisible();
    expect(uploads).toBe(0);
  });
  const name = `ANGI-36 live ${Date.now()}`;
  await page.getByLabel("Tên nhà hàng").fill(name);
  await page.getByLabel("Số điện thoại nhà hàng").fill("0901234567");
  await page.getByLabel("Địa chỉ", { exact: false }).fill("24 Nguyễn Hữu Huân");
  await page.getByLabel("Tỉnh / thành phố").fill("Thành phố Hà Nội");
  await expect(page.getByLabel("Quận / huyện")).toHaveCount(0);
  await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  const location = page.getByRole("dialog", { name: "Chọn vị trí nhà hàng" });
  await expect(
    location.getByRole("button", { name: "Lưu vị trí", exact: true }),
  ).toBeDisabled();
  await location.getByLabel("Vĩ độ").fill("21.0285");
  await location.getByLabel("Kinh độ").fill("105.8542");
  await location
    .getByRole("button", { name: "Lưu vị trí", exact: true })
    .click();
  await test.step("Upload cover/gallery through the real Next.js, BE and Cloudinary pipeline", async () => {
    await page
      .getByLabel("Ảnh bìa", { exact: true })
      .setInputFiles(image("cover.png"));
    await expect(
      page.getByRole("button", { name: /Bỏ ảnh bìa/ }),
    ).toBeEnabled();
    await page
      .getByLabel("Ảnh nhà hàng", { exact: true })
      .setInputFiles([image("gallery-one.png"), image("gallery-two.png")]);
    await expect(
      page.getByRole("button", { name: /Bỏ ảnh nhà hàng/ }),
    ).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: /Bỏ ảnh nhà hàng/ }).last(),
    ).toBeEnabled();
    const remove = page.getByRole("button", { name: /Bỏ ảnh bìa/ });
    const style = await remove.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      opacity: Number(getComputedStyle(element).opacity),
    }));
    expect(style.width).toBeLessThanOrEqual(26);
    expect(style.opacity).toBeLessThan(1);
    expect(uploads).toBe(3);
  });
  await page
    .getByRole("button", { name: /Bỏ ảnh nhà hàng/ })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: /Bỏ ảnh nhà hàng/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Hủy đăng ký nhà hàng?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tiếp tục đăng ký", exact: true })
    .click();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue(name);
  await screenshot(page, "registration-desktop");
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
  expect(submissions).toBe(1);
  const restaurant = await saved(page);
  expect(restaurant).toMatchObject({
    name,
    latitude: 21.0285,
    longitude: 105.8542,
    verificationStatus: "unverified",
    operatingStatus: "open",
    moderationStatus: "visible",
  });
  expect(restaurant.coverUrl).toMatch(/^https:\/\//);
  expect(restaurant.images).toHaveLength(1);
  await mutate(
    page,
    "owner/restaurant",
    "POST",
    {
      name,
      phone: "0901234567",
      addressLine: "24 Nguyễn Hữu Huân",
      district: "Hoàn Kiếm",
      provinceName: "Hà Nội",
      latitude: 21.0285,
      longitude: 105.8542,
    },
    409,
    "OWNER_ALREADY_HAS_RESTAURANT",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bạn đã có nhà hàng" }),
  ).toBeVisible();
});

test("ANGI-36: real backend enforces required coordinates, image type/size and gallery count", async ({
  page,
}) => {
  await login(page, ownerEmail("empty"));
  const body = {
    name: "Invalid local registration",
    phone: "0901234567",
    addressLine: "1 Local Street",
    district: "Quan 1",
    provinceName: "Ho Chi Minh",
  };
  const invalid = await mutate(
    page,
    "owner/restaurant",
    "POST",
    body,
    400,
    "VALIDATION_FAILED",
  );
  expect(invalid.errors).toHaveProperty("latitude");
  await mutate(
    page,
    "owner/restaurant",
    "POST",
    { ...body, latitude: 91, longitude: 106 },
    400,
    "VALIDATION_FAILED",
  );
  await mutate(
    page,
    "owner/restaurant",
    "POST",
    {
      ...body,
      latitude: 10,
      longitude: 106,
      imageMediaIds: Array(11).fill(999999),
    },
    400,
    "VALIDATION_FAILED",
  );
  for (const [name, mimeType, buffer, code] of [
    [
      "invalid.pdf",
      "application/pdf",
      Buffer.from("%PDF"),
      "UNSUPPORTED_MEDIA_TYPE",
    ],
    [
      "large.png",
      "image/png",
      Buffer.alloc(5 * 1024 * 1024 + 1),
      "FILE_TOO_LARGE",
    ],
  ] as const) {
    const response = await page.request.post("/api/backend/media", {
      headers: { Origin: origin },
      multipart: { purpose: "restaurant", file: { name, mimeType, buffer } },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).errorCode).toBe(code);
  }
});

test("ANGI-48: multiple/day, overnight, adjacent-day and week-boundary hours persist", async ({
  page,
}) => {
  await login(page, ownerEmail("hours"));
  await page.goto("/restaurant/profile?tab=hours");
  await expect(
    page.getByRole("button", { name: "Thêm khung giờ · Thứ hai", exact: true }),
  ).toBeVisible();
  await addSlot(page, "Thứ hai", 1, "06:00", "11:00");
  await addSlot(page, "Thứ hai", 2, "22:00", "02:00");
  await addSlot(page, "Thứ ba", 1, "02:00", "05:00");
  await addSlot(page, "Thứ bảy", 1, "23:00", "01:00");
  await addSlot(page, "Chủ nhật", 1, "01:00", "02:00");
  const response = page.waitForResponse(
    (value) =>
      value.url().endsWith("/api/backend/owner/restaurant/business-hours") &&
      value.request().method() === "PUT",
  );
  await page.locator('button[type="submit"]').click();
  const result = await response;
  expect(result.status()).toBe(200);
  const data = (await result.json()).data;
  expect(data.hours).toHaveLength(5);
  expect(typeof data.isOpenNow).toBe("boolean");
  await expect(
    page.getByText("Đã lưu giờ mở cửa.", { exact: true }),
  ).toBeVisible();
  expect((await saved(page)).businessHours).toEqual(data.hours);
  await page.reload();
  await expect(
    page.getByLabel("Giờ mở · Thứ hai · khung 2 *", { exact: true }),
  ).toHaveValue("22:00");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByLabel("Giờ đóng · Thứ bảy · khung 1 *", { exact: true }),
  ).toHaveValue("01:00");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await screenshot(page, "hours-mobile");
});

test("ANGI-48: invalid/equal/overlapping intervals are rejected; cancel and empty-week use modals", async ({
  page,
}) => {
  await login(page, ownerEmail("hours"));
  const initial: BusinessHourDto[] = [
    { dayOfWeek: 1, openTime: "09:00", closeTime: "12:00" },
  ];
  await mutate(page, "owner/restaurant/business-hours", "PUT", {
    hours: initial,
  });
  await page.goto("/restaurant/profile?tab=hours");
  await expect(
    page.getByLabel("Giờ mở · Thứ hai · khung 1 *", { exact: true }),
  ).toHaveValue("09:00");
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().endsWith("/business-hours"))
      writes++;
  });
  await page
    .getByLabel("Giờ đóng · Thứ hai · khung 1 *", { exact: true })
    .fill("09:00");
  await page.locator('button[type="submit"]').click();
  await expect(
    page.getByText("Giờ mở và giờ đóng phải khác nhau.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Giờ đóng · Thứ hai · khung 1 *", { exact: true })
    .fill("12:00");
  await addSlot(page, "Thứ hai", 2, "11:00", "13:00");
  await page.locator('button[type="submit"]').click();
  await expect(
    page.getByText(
      "Các khung giờ không được chồng lên nhau, kể cả qua nửa đêm.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(writes).toBe(0);
  expect((await saved(page)).businessHours).toEqual(initial);
  for (const hours of [
    [{ dayOfWeek: 1, openTime: "09:00", closeTime: "09:00" }],
    [
      { dayOfWeek: 1, openTime: "22:00", closeTime: "02:00" },
      { dayOfWeek: 2, openTime: "01:00", closeTime: "03:00" },
    ],
    [
      { dayOfWeek: 6, openTime: "23:00", closeTime: "02:00" },
      { dayOfWeek: 0, openTime: "01:00", closeTime: "03:00" },
    ],
  ])
    await mutate(
      page,
      "owner/restaurant/business-hours",
      "PUT",
      { hours },
      400,
    );
  expect((await saved(page)).businessHours).toEqual(initial);
  await page.getByRole("button", { name: "Hủy thay đổi", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bỏ thay đổi", exact: true })
    .click();
  await expect(
    page.getByLabel("Giờ mở · Thứ hai · khung 1 *", { exact: true }),
  ).toHaveValue("09:00");
  await expect(page.getByLabel(/^Giờ mở ·/)).toHaveCount(1);
  await page
    .getByRole("button", { name: "Xóa lịch tuần", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xóa lịch tuần", exact: true })
    .click();
  await page.locator('button[type="submit"]').click();
  await expect(
    page.getByText("Đã lưu giờ mở cửa.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Bạn chưa khai báo giờ mở cửa.", { exact: true }),
  ).toBeVisible();
  expect((await saved(page)).businessHours).toEqual([]);
});

test("ANGI-55: all three statuses, confirmation cancellation, 500-char note and persistence", async ({
  page,
}) => {
  test.skip(
    !latest,
    "Working branch does not contain the merged ANGI-55 implementation.",
  );
  await login(page, ownerEmail("status"));
  await page.goto("/restaurant/profile?tab=status");
  const select = page.getByLabel("Trạng thái mới", { exact: true });
  await expect(select).toHaveValue("open");
  const original = await saved(page);
  await select.selectOption("temporarily_closed");
  await page
    .getByLabel("Lý do (không bắt buộc)", { exact: true })
    .fill("  Owner task audit check  ");
  await page
    .getByRole("button", { name: "Cập nhật trạng thái", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  expect((await saved(page)).operatingStatus).toBe("open");
  for (const status of [
    "temporarily_closed",
    "permanently_closed",
    "open",
  ] as const) {
    await select.selectOption(status);
    if (status === "permanently_closed")
      await page
        .getByLabel("Lý do (không bắt buộc)", { exact: true })
        .fill("n".repeat(500));
    await page
      .getByRole("button", { name: "Cập nhật trạng thái", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    if (status === "permanently_closed")
      await expect(dialog).toHaveAccessibleName("Xác nhận đóng cửa vĩnh viễn?");
    const result = page.waitForResponse(
      (response) =>
        response.url().endsWith("/operating-status") &&
        response.request().method() === "PUT",
    );
    await dialog
      .getByRole("button", { name: "Xác nhận cập nhật", exact: true })
      .click();
    expect((await result).status()).toBe(200);
    await expect(
      page.getByText("Đã cập nhật trạng thái hoạt động.", { exact: true }),
    ).toBeVisible();
    const persisted = await saved(page);
    expect(persisted.operatingStatus).toBe(status);
    expect(persisted.verificationStatus).toBe(original.verificationStatus);
    expect(persisted.moderationStatus).toBe(original.moderationStatus);
    expect(persisted.businessHours).toEqual(original.businessHours);
    await page.reload();
    await expect(select).toHaveValue(status);
  }
  await mutate(
    page,
    "owner/restaurant/operating-status",
    "PUT",
    { operatingStatus: "invalid" },
    400,
    "VALIDATION_FAILED",
  );
  await mutate(
    page,
    "owner/restaurant/operating-status",
    "PUT",
    { operatingStatus: "temporarily_closed", note: "n".repeat(501) },
    400,
    "VALIDATION_FAILED",
  );
  expect((await saved(page)).operatingStatus).toBe("open");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await screenshot(page, "status-mobile");
});

test("ANGI-55: suspended restaurant rejects reopening with 409 and still allows permanent closure", async ({
  page,
}) => {
  test.skip(!latest, "Working branch lacks ANGI-55.");
  await login(page, ownerEmail("suspended"));
  await page.goto("/restaurant/profile?tab=status");
  await expect(page.getByLabel("Trạng thái mới", { exact: true })).toHaveValue(
    "temporarily_closed",
  );
  await page.getByLabel("Trạng thái mới", { exact: true }).selectOption("open");
  await page
    .getByLabel("Lý do (không bắt buộc)", { exact: true })
    .fill("Keep draft on real 409");
  await page
    .getByRole("button", { name: "Cập nhật trạng thái", exact: true })
    .click();
  const rejected = page.waitForResponse(
    (response) =>
      response.url().endsWith("/operating-status") &&
      response.request().method() === "PUT",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận cập nhật", exact: true })
    .click();
  expect((await rejected).status()).toBe(409);
  await expect(
    page.getByText(
      "Nhà hàng đang bị đình chỉ nên chưa thể mở lại. Vui lòng liên hệ bộ phận hỗ trợ.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByLabel("Lý do (không bắt buộc)", { exact: true }),
  ).toHaveValue("Keep draft on real 409");
  expect((await saved(page)).operatingStatus).toBe("temporarily_closed");
  await screenshot(page, "suspended-reopening");
  await page
    .getByLabel("Trạng thái mới", { exact: true })
    .selectOption("permanently_closed");
  await page
    .getByRole("button", { name: "Cập nhật trạng thái", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận cập nhật", exact: true })
    .click();
  await expect(
    page.getByText("Đã cập nhật trạng thái hoạt động.", { exact: true }),
  ).toBeVisible();
  expect((await saved(page)).operatingStatus).toBe("permanently_closed");
});

test("ANGI-48/55: owner without a restaurant sees onboarding and receives real 404", async ({
  page,
}) => {
  await login(page, ownerEmail("empty"));
  for (const tab of latest ? ["hours", "status"] : ["hours"]) {
    await page.goto(`/restaurant/profile?tab=${tab}`);
    await expect(
      page.getByRole("heading", { name: "Bạn chưa đăng ký nhà hàng" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Đăng ký nhà hàng", exact: true }),
    ).toBeVisible();
  }
  await mutate(
    page,
    "owner/restaurant/business-hours",
    "PUT",
    { hours: [] },
    404,
    "RESTAURANT_NOT_FOUND",
  );
  if (latest)
    await mutate(
      page,
      "owner/restaurant/operating-status",
      "PUT",
      { operatingStatus: "open" },
      404,
      "RESTAURANT_NOT_FOUND",
    );
});

test("ANGI-36/48/55: traveler role and foreign Origin cannot mutate an owner restaurant", async ({
  page,
}) => {
  await login(page, "traveler@angi.local");
  const operations: [string, string, object][] = [
    ["owner/restaurant", "POST", {}],
    ["owner/restaurant/business-hours", "PUT", { hours: [] }],
  ];
  if (latest)
    operations.push([
      "owner/restaurant/operating-status",
      "PUT",
      { operatingStatus: "open" },
    ]);
  for (const [path, method, body] of operations)
    await mutate(page, path, method, body, 403, "FORBIDDEN");
  await login(page, ownerEmail("status"));
  for (const [path, method, data] of operations) {
    const response = await page.request.fetch(`/api/backend/${path}`, {
      method,
      headers: { Origin: "https://untrusted.example" },
      data,
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).errorCode).toBe("FORBIDDEN");
  }
});

test("WORKING BRANCH FINDING: ANGI-55 has a read-only status tab and no PUT proxy", async ({
  page,
}) => {
  test.skip(latest, "Diagnostic applies only to the older working source.");
  await login(page, ownerEmail("status"));
  await page.goto("/restaurant/profile?tab=status");
  await expect(
    page.getByRole("heading", { name: "Trạng thái nhà hàng", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Trạng thái mới", { exact: true })).toHaveCount(
    0,
  );
  await mutate(
    page,
    "owner/restaurant/operating-status",
    "PUT",
    { operatingStatus: "temporarily_closed" },
    404,
    "ROUTE_NOT_FOUND",
  );
  expect((await saved(page)).operatingStatus).toBe("open");
  await screenshot(page, "missing-status-integration");
});
