import { createServer, type Server } from "node:http";
import { test, expect, type Page } from "@playwright/test";
import type {
  OwnerRestaurantDto,
  UpdateBusinessHoursRequestDto,
} from "../../src/features/owner/restaurant-types";
import { ownerRestaurantSample } from "../fixtures/owner-restaurant";
import {
  addSlot,
  applyDay,
  closing,
  dayRow,
  editDay,
  opening,
  saveWeek,
} from "../helpers/business-hours";

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

const save = saveWeek;
async function login(page: Page, traveler = false) {
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill(traveler ? "traveler@hours.test" : "owner@hours.test");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(
    traveler ? /\/demo\/traveler$/ : /\/restaurant$/,
  );
}
async function openHours(page: Page) {
  await login(page);
  await page.goto("/restaurant/profile?tab=hours");
  await expect(
    page.getByRole("heading", { name: "Lịch phục vụ trong tuần", exact: true }),
  ).toBeVisible();
}

test.beforeEach(async ({ page, context }) => {
  await context.route("**/*", (route) =>
    ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
  page.on("dialog", async (dialog) => {
    await dialog.dismiss();
    throw new Error(`Unexpected native ${dialog.type()}`);
  });
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("compact week loads OWN-02; day edits stay local until OWN-04 saves the complete week", async ({
  page,
}) => {
  await openHours(page);
  await expect(dayRow(page)).toContainText("06:00–13:30");
  await expect(save(page)).toBeDisabled();
  await expect(page.getByLabel(/^Giờ mở ·/)).toHaveCount(0);
  await addSlot(page, "Thứ hai", 2, "22:00", "02:00");
  await addSlot(page, "Thứ ba", 1, "02:00", "05:00");
  await addSlot(page, "Chủ nhật", 1, "09:00", "12:00");
  expect(requests).toHaveLength(0);
  await expect(dayRow(page)).toContainText("22:00–02:00 hôm sau");
  await expect(dayRow(page)).toContainText("Đóng lúc 02:00 ngày hôm sau.");
  await save(page).click();
  await expect(
    page.getByText("Đã lưu giờ mở cửa.", { exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].hours).toHaveLength(4);
  expect(requests[0].hours).toEqual(
    expect.arrayContaining([
      { dayOfWeek: 1, openTime: "06:00", closeTime: "13:30" },
      { dayOfWeek: 1, openTime: "22:00", closeTime: "02:00" },
      { dayOfWeek: 2, openTime: "02:00", closeTime: "05:00" },
      { dayOfWeek: 0, openTime: "09:00", closeTime: "12:00" },
    ]),
  );
  expect(current).toMatchObject({
    name: ownerRestaurantSample.name,
    operatingStatus: "open",
    verificationStatus: "verified",
    moderationStatus: "visible",
    images: ownerRestaurantSample.images,
  });
  await expect(save(page)).toBeDisabled();
  await page.reload();
  await expect(dayRow(page)).toContainText("22:00–02:00 hôm sau");
});

test("day validation requires both times, rejects equal times and focuses the invalid field", async ({
  page,
}) => {
  await openHours(page);
  await editDay(page);
  await closing(page).fill("");
  await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
  await expect(closing(page)).toHaveAttribute("aria-invalid", "true");
  await expect(closing(page)).toBeFocused();
  await expect(
    page.getByText("Nhập giờ đóng theo dạng HH:mm.", { exact: true }),
  ).toBeVisible();
  await closing(page).fill("06:00");
  await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
  await expect(
    page.getByText("Giờ mở và giờ đóng phải khác nhau.", { exact: true }),
  ).toBeVisible();
  await closing(page).fill("13:30");
  await page
    .getByRole("button", { name: "Thêm khoảng giờ", exact: true })
    .click();
  await closing(page, "Thứ hai", 2).fill("21:00");
  await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
  await expect(opening(page, "Thứ hai", 2)).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(opening(page, "Thứ hai", 2)).toBeFocused();
  expect(requests).toHaveLength(0);
});

for (const example of [
  {
    first: "Thứ hai",
    day: "Thứ hai",
    open: "23:00",
    close: "03:00",
    corrected: "03:00",
    end: "05:00",
  },
  {
    first: "Thứ hai",
    day: "Thứ ba",
    open: "01:00",
    close: "03:00",
    corrected: "02:00",
    end: "05:00",
  },
  {
    first: "Thứ bảy",
    day: "Chủ nhật",
    open: "01:00",
    close: "03:00",
    corrected: "02:00",
    end: "05:00",
  },
  {
    first: "Chủ nhật",
    day: "Thứ hai",
    open: "01:00",
    close: "03:00",
    corrected: "02:00",
    end: "05:00",
  },
])
  test(`rejects overlap ${example.first} / ${example.day}, allows adjoining hours`, async ({
    page,
  }) => {
    current!.businessHours = [];
    await openHours(page);
    await addSlot(page, example.first, 1, "22:00", "02:00");
    const slot = example.day === example.first ? 2 : 1;
    await page
      .getByRole("button", {
        name: `Thêm khoảng · ${example.day}`,
        exact: true,
      })
      .click();
    await opening(page, example.day, slot).fill(example.open);
    await closing(page, example.day, slot).fill(example.close);
    await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /Các (khoảng|khung)/ }),
    ).toContainText("không được chồng nhau");
    await expect(
      page.getByRole("alert").filter({ hasText: /Các (khoảng|khung)/ }),
    ).toContainText(example.first);
    await expect(
      page.getByRole("alert").filter({ hasText: /Các (khoảng|khung)/ }),
    ).toContainText(example.day);
    expect(requests).toHaveLength(0);
    await opening(page, example.day, slot).fill(example.corrected);
    await closing(page, example.day, slot).fill(example.end);
    await applyDay(page);
    await expect(save(page)).toBeEnabled();
  });

test("backend errors preserve the week, identify the day/field and allow correction and retry", async ({
  page,
}) => {
  await openHours(page);
  await addSlot(page, "Thứ hai", 2, "17:00", "22:00");
  nextError = { errorCode: "INVALID_BUSINESS_HOURS" };
  await save(page).click();
  await expect(
    page.getByRole("alert").filter({ hasText: /Các (khoảng|khung)/ }),
  ).toContainText("Các khung giờ không được chồng lên nhau");
  await expect(dayRow(page)).toContainText("17:00–22:00");
  nextError = {
    errorCode: "VALIDATION_FAILED",
    errors: { "Hours[1].CloseTime": ["Giờ đóng cửa chưa hợp lệ."] },
  };
  await save(page).click();
  await expect(dayRow(page)).toContainText("Giờ đóng cửa chưa hợp lệ.");
  await expect(
    page.getByRole("button", { name: "Chỉnh giờ · Thứ hai", exact: true }),
  ).toBeFocused();
  await editDay(page);
  await expect(closing(page, "Thứ hai", 2)).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await closing(page, "Thứ hai", 2).fill("21:00");
  await applyDay(page);
  await save(page).click();
  await expect(
    page.getByText("Đã lưu giờ mở cửa.", { exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(3);
});

test("modal Escape/discard returns focus; weekly cancel restores saved hours and duplicate saves are blocked", async ({
  page,
}) => {
  await openHours(page);
  await editDay(page);
  await expect(opening(page)).toBeFocused();
  await opening(page).fill("07:00");
  await page.keyboard.press("Escape");
  const discard = page.getByRole("dialog", {
    name: "Bỏ thay đổi của ngày này?",
    exact: true,
  });
  await expect(discard).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(discard).not.toBeVisible();
  await expect(opening(page)).toHaveValue("07:00");
  await page.keyboard.press("Escape");
  await discard
    .getByRole("button", { name: "Bỏ thay đổi", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Chỉnh giờ · Thứ hai", exact: true }),
  ).toBeFocused();
  await expect(dayRow(page)).toContainText("06:00–13:30");
  await editDay(page);
  await opening(page).fill("07:00");
  await applyDay(page);
  delay = true;
  await save(page).click();
  await expect(save(page)).toBeDisabled();
  await save(page).evaluate((button) =>
    button
      .closest("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  await expect(
    page.getByText("Đã lưu giờ mở cửa.", { exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(1);
  await editDay(page);
  await opening(page).fill("08:00");
  await applyDay(page);
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await page
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  await expect(dayRow(page)).toContainText("08:00–13:30");
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
  await expect(dayRow(page)).toContainText("07:00–13:30");
  await expect(save(page)).toBeDisabled();
});

test("deleting the last interval and saving an empty week require modals and retain operating status", async ({
  page,
}) => {
  await openHours(page);
  await editDay(page);
  await page
    .getByRole("button", { name: "Xóa khoảng 1 · Thứ hai", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  await expect(opening(page)).toHaveValue("06:00");
  await page
    .getByRole("button", { name: "Xóa khoảng 1 · Thứ hai", exact: true })
    .click();
  await page.getByRole("button", { name: "Xóa khoảng", exact: true }).click();
  await applyDay(page);
  await expect(dayRow(page)).toContainText("Chưa khai báo giờ");
  await save(page).click();
  const empty = page.getByRole("dialog", {
    name: "Lưu lịch tuần trống?",
    exact: true,
  });
  await expect(empty).toBeVisible();
  expect(requests).toHaveLength(0);
  await empty
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  await save(page).click();
  await empty
    .getByRole("button", { name: "Lưu lịch trống", exact: true })
    .click();
  await expect(
    page.getByText("Đã lưu giờ mở cửa.", { exact: true }),
  ).toBeVisible();
  expect(requests).toEqual([{ hours: [] }]);
  expect(current!.operatingStatus).toBe("open");
  await page.reload();
  await expect(
    page.getByText("Chưa khai báo giờ", { exact: true }),
  ).toHaveCount(7);
  await expect(
    page.getByText("Chưa khai báo không có nghĩa là đóng cửa", { exact: true }),
  ).toBeVisible();
});

test("GET errors retry without demo fallback and missing owners can register", async ({
  page,
}) => {
  await login(page);
  failGet = true;
  await page.goto("/restaurant/profile?tab=hours");
  await expect(
    page.getByRole("heading", { name: "Chưa tải được giờ mở cửa" }),
  ).toBeVisible();
  failGet = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(dayRow(page)).toContainText("06:00–13:30");
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

test("role, origin and exact method restrictions protect OWN-04", async ({
  page,
}) => {
  await login(page, true);
  await page.goto("/restaurant/profile?tab=hours");
  await expect(page).toHaveURL(/\/demo\/traveler$/);
  for (const origin of ["http://localhost:3001", "https://foreign.example"])
    expect(
      (
        await page.request.put("/api/backend/owner/restaurant/business-hours", {
          headers: { origin },
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

test("applied day drafts require a modal before switching profile tabs", async ({
  page,
}) => {
  await openHours(page);
  await editDay(page);
  await opening(page).fill("07:30");
  await applyDay(page);
  await page.getByRole("tab", { name: "Thông tin", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Bỏ thay đổi giờ mở cửa chưa lưu?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  await expect(dayRow(page)).toContainText("07:30–13:30");
  await page.getByRole("tab", { name: "Thông tin", exact: true }).click();
  await page
    .getByRole("button", { name: "Bỏ thay đổi và chuyển thẻ", exact: true })
    .click();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue(
    ownerRestaurantSample.name,
  );
  expect(requests).toHaveLength(0);
});

test("reference layout and day dialogs fit desktop/mobile and keyboard Tab stays in the modal", async ({
  page,
}) => {
  current!.businessHours = [1, 2, 3, 4, 5]
    .flatMap((dayOfWeek) => [
      { dayOfWeek, openTime: "11:00", closeTime: "14:00" },
      { dayOfWeek, openTime: "17:00", closeTime: "21:00" },
    ])
    .concat([{ dayOfWeek: 6, openTime: "18:00", closeTime: "02:00" }]);
  await page.setViewportSize({ width: 1440, height: 1200 });
  await openHours(page);
  await expect(dayRow(page, "Chủ nhật")).toContainText("Chưa khai báo giờ");
  await page.screenshot({
    path: "artifacts/owner-hours-desktop.png",
    fullPage: true,
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await editDay(page);
    await expect(opening(page)).toBeFocused();
    for (let index = 0; index < 12; index++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest("dialog[open]"),
        ),
      ).toBe(true);
    }
    expect(
      await page
        .getByRole("dialog", { name: "Chỉnh giờ · Thứ hai", exact: true })
        .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
    ).toBe(true);
    if (width === 390)
      await page.screenshot({
        path: "artifacts/owner-hours-day-mobile.png",
        fullPage: true,
      });
    await page
      .getByRole("button", { name: "Đóng hộp thoại", exact: true })
      .click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/owner-hours-mobile.png",
    fullPage: true,
  });
});

test("demo preserves multiple intervals across profile navigation without a live PUT", async ({
  page,
}) => {
  await page.goto("/demo/owner/profile?tab=hours");
  await editDay(page);
  await closing(page).fill("13:30");
  await applyDay(page);
  await addSlot(page, "Thứ hai", 2, "17:00", "22:00");
  await save(page).click();
  await expect(
    page.getByText("Đã lưu giờ mở cửa trong bản minh họa.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Thông tin", exact: true }).click();
  await expect(page.getByLabel("Tên nhà hàng")).toHaveValue("Bếp Nhà");
  await page.getByRole("tab", { name: "Giờ mở cửa", exact: true }).click();
  await expect(dayRow(page)).toContainText("17:00–22:00");
  expect(requests).toHaveLength(0);
});
