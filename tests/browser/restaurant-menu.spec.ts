import { createServer, type Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";
import { ownerRestaurantSample } from "../fixtures/owner-restaurant";
import { menuDetailSample, ownerMenuSample } from "../fixtures/restaurant-menu";
import type {
  MenuDetailDto,
  MenuItemDto,
  MenuStatus,
  OwnerMenuDto,
} from "../../src/features/owner/menu-types";

let server: Server,
  menu: OwnerMenuDto,
  details: MenuDetailDto[],
  nextItem: number;
let calls: { method: string; path: string; raw: string }[];
let failure: {
  match: string;
  status: number;
  code: string;
  errors?: Record<string, string[]>;
  data?: unknown;
} | null;
let verified: boolean, missing: boolean;
/** Keeps a failure active across repeated loads (React dev mode runs effects twice). */
let stickyFailure = false;
const base = "/api/backend/owner/restaurant/menu-submissions";
test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString(),
      url = new URL(req.url!, "http://127.0.0.1"),
      path = url.pathname.replace("/api/v1/", "");
    calls.push({ method: req.method!, path: path + url.search, raw });
    const send = (
      status: number,
      data: unknown,
      code: string | null = null,
      errors?: Record<string, string[]>,
    ) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: status < 400,
          data,
          errorCode: code,
          message: null,
          errors,
        }),
      );
    };
    if (path === "auth/login") {
      const email = JSON.parse(raw).email as string;
      send(200, {
        accessToken: "menu-local-access",
        refreshToken: "menu-local-refresh",
        accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() + 2592000000).toISOString(),
        user: {
          id: 12,
          email,
          displayName: "Chủ nhà hàng",
          avatarUrl: null,
          status: "active",
          needsPreferenceSurvey: null,
          role: email.startsWith("traveler") ? "TRAVELER" : "RESTAURANT_OWNER",
        },
      });
      return;
    }
    if (failure && path.endsWith(failure.match)) {
      const error = failure;
      if (!stickyFailure) failure = null;
      send(error.status, error.data ?? null, error.code, error.errors);
      return;
    }
    if (path === "owner/restaurant") {
      send(
        missing ? 404 : 200,
        missing
          ? null
          : {
              ...ownerRestaurantSample,
              verificationStatus: verified ? "verified" : "unverified",
            },
        missing ? "RESTAURANT_NOT_FOUND" : null,
      );
      return;
    }
    if (path === "owner/restaurant/menu") {
      send(
        missing ? 404 : 200,
        missing ? null : menu,
        missing ? "RESTAURANT_NOT_FOUND" : null,
      );
      return;
    }
    if (path === "tags") {
      send(200, [
        { id: 2, tagType: "meal_time", code: "lunch", name: "Bữa trưa" },
        { id: 9, tagType: "category", code: "spicy", name: "Cay" },
      ]);
      return;
    }
    if (path === "media") {
      expect(raw).toContain('name="purpose"\r\n\r\ndish');
      send(201, {
        id: 9100,
        url: "/assets/figma/Plus.svg",
        mimeType: "image/png",
        sizeBytes: 50,
        purpose: "dish",
        createdAt: new Date().toISOString(),
      });
      return;
    }
    if (path.endsWith("/availability")) {
      const dish = menu.dishes[0];
      dish.isAvailable = JSON.parse(raw).isAvailable;
      send(200, { dishId: dish.id, isAvailable: dish.isAvailable });
      return;
    }
    if (path === "owner/restaurant/menu-submissions") {
      if (req.method === "POST") {
        expect(raw).toBe("");
        if (menu.openSubmission) {
          send(409, { id: menu.openSubmission.id }, "SUBMISSION_ALREADY_OPEN");
          return;
        }
        const detail = {
          ...structuredClone(menuDetailSample),
          id: Math.max(13, ...details.map((value) => value.id)) + 1,
        };
        details.unshift(detail);
        menu.openSubmission = { id: detail.id, status: "draft" };
        const { removedDishes, ...body } = detail;
        void removedDishes;
        send(201, body);
      } else {
        const status = url.searchParams.get("status"),
          page = Number(url.searchParams.get("page") ?? 1),
          pageSize = Number(url.searchParams.get("pageSize") ?? 20);
        const filtered = details.filter(
          (value) => !status || value.status === status,
        );
        send(200, {
          items: filtered
            .slice((page - 1) * pageSize, page * pageSize)
            .map(({ items, removedDishes, ...rest }) => {
              void items;
              void removedDishes;
              return rest;
            }),
          page,
          pageSize,
          totalItems: filtered.length,
          totalPages: Math.ceil(filtered.length / pageSize),
        });
      }
      return;
    }
    const match = path.match(
      /^owner\/restaurant\/menu-submissions\/(\d+)(?:\/(items|cancel)(?:\/(\d+))?)?$/,
    );
    if (match) {
      const detail = details.find((value) => value.id === Number(match[1]));
      if (!detail) {
        send(404, null, "SUBMISSION_NOT_FOUND");
        return;
      }
      if (!match[2]) {
        send(200, detail);
        return;
      }
      if (match[2] === "cancel") {
        expect(raw).toBe("");
        detail.status = "cancelled";
        menu.openSubmission = null;
        const { items, removedDishes, ...body } = detail;
        void items;
        void removedDishes;
        send(200, body);
        return;
      }
      if (detail.status !== "draft") {
        send(409, null, "SUBMISSION_NOT_EDITABLE");
        return;
      }
      if (req.method === "POST") {
        const body = JSON.parse(raw);
        const item: MenuItemDto = {
          ...body,
          id: ++nextItem,
          sourceDishId: null,
          change: "new",
          coverMediaId: body.coverMediaId ?? null,
          coverUrl: body.coverMediaId ? "/assets/figma/Plus.svg" : null,
          tagIds: body.tagIds ?? [],
          sortOrder: body.sortOrder ?? detail.items.length + 1,
          resultDishId: null,
        };
        detail.items.push(item);
        send(201, item);
        return;
      }
      const item = detail.items.find((value) => value.id === Number(match[3]));
      if (!item) {
        send(404, null, "SUBMISSION_ITEM_NOT_FOUND");
        return;
      }
      if (req.method === "DELETE") {
        expect(raw).toBe("");
        detail.items = detail.items.filter((value) => value.id !== item.id);
        const source = menu.dishes.find(
          (value) => value.id === item.sourceDishId,
        );
        if (source) detail.removedDishes.push(source);
        send(200, null);
        return;
      }
      Object.assign(item, JSON.parse(raw));
      if (JSON.parse(raw).coverMediaId === null) item.coverUrl = null;
      item.change = item.sourceDishId === null ? "new" : "edited";
      send(200, item);
      return;
    }
    send(404, null, "ROUTE_NOT_FOUND");
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
test.beforeEach(async ({ page, context }) => {
  menu = structuredClone(ownerMenuSample);
  details = [];
  nextItem = 340;
  calls = [];
  failure = null;
  stickyFailure = false;
  verified = true;
  missing = false;
  page.on("dialog", async (dialog) => {
    await dialog.dismiss();
    throw new Error("Native dialog is prohibited");
  });
  await context.route("**/*", (route) =>
    ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
});
async function login(page: Page, role = "owner") {
  await page.goto("/login");
  await page.getByLabel(/^Email/).fill(`${role}@menu.test`);
  await page.getByLabel(/^Mật khẩu/).fill("TestPassword123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto("/restaurant/menu");
}
async function create(page: Page) {
  await page.getByRole("button", { name: "Tạo bản nháp", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Thêm món", exact: true }),
  ).toBeVisible();
}
async function confirm(page: Page, title: string) {
  const modal = page.getByRole("dialog", { name: title, exact: true });
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(modal).not.toBeVisible();
}
async function newDish(page: Page, name = "Mì Quảng gà") {
  await page.getByRole("button", { name: "Thêm món", exact: true }).click();
  const modal = page.getByRole("dialog", {
    name: "Thêm món vào bản nháp",
    exact: true,
  });
  await modal.getByLabel("Tên món *", { exact: true }).fill(name);
  await modal
    .getByLabel("Mô tả món *", { exact: true })
    .fill("Sợi mì vàng, nước lèo sệt, gà ta và đậu phộng rang.");
  await modal.getByLabel("Giá (VND) *", { exact: true }).fill("40000");
  return modal;
}
test("full F50 workflow preserves live menu, sends dish media, precise PATCH, null DELETE and no-body cancel", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "Đánh dấu hết món: Bún bò Huế", exact: true })
    .click();
  await confirm(page, "Cập nhật tình trạng phục vụ?");
  await expect(page.getByText("Hết món", { exact: true })).toBeVisible();
  await create(page);
  const modal = await newDish(page);
  await modal.getByLabel("Cay", { exact: true }).check();
  await modal.getByLabel("Ảnh món ăn", { exact: true }).setInputFiles({
    name: "dish.png",
    mimeType: "image/png",
    buffer: Buffer.from("png"),
  });
  await expect(
    modal.getByRole("button", { name: "Bỏ ảnh món ăn" }),
  ).toBeVisible();
  await modal.getByRole("button", { name: "Lưu món", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mì Quảng gà", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sửa Mì Quảng gà", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Sửa món trong bản nháp",
    exact: true,
  });
  await editor.getByLabel("Giá (VND) *", { exact: true }).fill("55000");
  await editor.getByLabel("Cay", { exact: true }).uncheck();
  await editor.getByRole("button", { name: "Bỏ ảnh món ăn" }).click();
  await confirm(page, "Bỏ ảnh món ăn?");
  await editor.getByRole("button", { name: "Lưu món", exact: true }).click();
  await expect(editor).not.toBeVisible();
  expect(
    JSON.parse(calls.findLast((value) => value.method === "PATCH")!.raw),
  ).toEqual({ price: 55000, coverMediaId: null, tagIds: [] });
  await page
    .getByRole("button", { name: "Xóa Bún bò Huế", exact: true })
    .click();
  await confirm(page, "Xóa món khỏi bản nháp?");
  await expect(
    page.getByRole("heading", { name: "Món đã bỏ so với thực đơn đang bán" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Đang bán", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Bún bò Huế", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Mì Quảng gà", exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Mở bản thực đơn", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hủy bản thực đơn", exact: true })
    .click();
  await confirm(page, "Hủy bản thực đơn?");
  await expect(page.getByText("Đã hủy", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Tạo bản nháp", exact: true }),
  ).toBeVisible();
  expect(calls.some((value) => value.path.endsWith("/submit"))).toBe(false);
});
test("pending/history is readonly, exposes feedback and supports cancelling pending", async ({
  page,
}) => {
  details = [
    {
      ...structuredClone(menuDetailSample),
      status: "pending",
      ownerNote: "Ghi chú đang chờ",
      submittedAt: "2026-10-03T02:00:00Z",
    },
  ];
  menu.openSubmission = { id: 14, status: "pending" };
  await login(page);
  await page
    .getByRole("button", { name: "Mở bản thực đơn", exact: true })
    .click();
  await expect(page.getByText("Chờ duyệt", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Thêm món", exact: true }),
  ).not.toBeVisible();
  await expect(page.getByRole("button", { name: /^Sửa / })).not.toBeVisible();
  await page
    .getByRole("button", { name: "Hủy bản thực đơn", exact: true })
    .click();
  await confirm(page, "Hủy bản thực đơn?");
  await expect(page.getByText("Đã hủy", { exact: true })).toBeVisible();
});
test("validation, unsaved cancellation, server field errors retain entered values and retry once", async ({
  page,
}) => {
  await login(page);
  await create(page);
  await page.getByRole("button", { name: "Thêm món", exact: true }).click();
  const modal = page.getByRole("dialog", {
    name: "Thêm món vào bản nháp",
    exact: true,
  });
  await modal.getByRole("button", { name: "Lưu món", exact: true }).click();
  await expect(
    modal.getByText("Tên món phải từ 1 đến 200 ký tự."),
  ).toBeVisible();
  await modal.getByLabel("Tên món *", { exact: true }).fill("Món chưa lưu");
  await modal.getByRole("button", { name: "Đóng", exact: true }).click();
  await confirm(page, "Bỏ thay đổi chưa lưu?");
  const editor = await newDish(page);
  failure = {
    match: "/items",
    status: 400,
    code: "VALIDATION_FAILED",
    errors: { Price: ["Giá thử nghiệm bị từ chối."] },
  };
  await editor.getByRole("button", { name: "Lưu món", exact: true }).click();
  await expect(editor.getByText("Giá thử nghiệm bị từ chối.")).toBeVisible();
  await expect(editor.getByLabel("Tên món *", { exact: true })).toHaveValue(
    "Mì Quảng gà",
  );
  await editor.getByRole("button", { name: "Lưu món", exact: true }).click();
  await expect(editor).not.toBeVisible();
  expect(
    calls.filter(
      (value) => value.path.endsWith("/14/items") && value.method === "POST",
    ),
  ).toHaveLength(2);
});
test("open conflict, stale draft and load failures offer explicit recovery", async ({
  page,
}) => {
  await login(page);
  details = [structuredClone(menuDetailSample)];
  failure = {
    match: "menu-submissions",
    status: 409,
    code: "SUBMISSION_ALREADY_OPEN",
    data: { id: 14 },
  };
  await page.getByRole("button", { name: "Tạo bản nháp", exact: true }).click();
  await page
    .getByRole("button", { name: "Mở bản thực đơn hiện có", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Thêm món", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sửa Bún bò Huế", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Sửa món trong bản nháp",
    exact: true,
  });
  await modal.getByLabel("Giá (VND) *", { exact: true }).fill("60000");
  failure = {
    match: "/items/340",
    status: 409,
    code: "SUBMISSION_NOT_EDITABLE",
  };
  await modal.getByRole("button", { name: "Lưu món", exact: true }).click();
  await expect(modal.getByText(/không còn ở trạng thái nháp/)).toBeVisible();
  await expect(modal.getByLabel("Giá (VND) *", { exact: true })).toHaveValue(
    "60000",
  );
});
test("history forwards status/page; reviewed records show feedback and no edit actions", async ({
  page,
}) => {
  details = Array.from({ length: 7 }, (_, index) => ({
    ...structuredClone(menuDetailSample),
    id: 20 - index,
    status: (index === 6 ? "rejected" : "approved") as MenuStatus,
    reviewedBy: { id: 3, displayName: "Kiểm duyệt viên", avatarUrl: null },
    reviewedAt: "2026-10-03T02:00:00Z",
    reviewNote: "Cần bổ sung mô tả món.",
  }));
  await login(page);
  await page.getByRole("tab", { name: "Lịch sử", exact: true }).click();
  await page.getByRole("button", { name: "Trang sau", exact: true }).click();
  await expect(page.getByText("7 bản · Trang 2 / 2")).toBeVisible();
  await page
    .getByLabel("Lọc trạng thái", { exact: true })
    .selectOption("rejected");
  await page.getByRole("button", { name: "Xem bản #14", exact: true }).click();
  await expect(
    page.getByText("Kiểm duyệt viên", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Cần bổ sung mô tả món.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Hủy bản thực đơn", exact: true }),
  ).not.toBeVisible();
  expect(calls.some((value) => value.path.includes("page=2&pageSize=5"))).toBe(
    true,
  );
  expect(
    calls.some((value) =>
      value.path.includes("page=1&pageSize=5&status=rejected"),
    ),
  ).toBe(true);
});
test("unverified/missing/transport states never fall back to demo menu", async ({
  page,
}) => {
  verified = false;
  await login(page);
  await expect(
    page.getByRole("button", { name: "Tạo bản nháp", exact: true }),
  ).toBeDisabled();
  missing = true;
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Đăng ký nhà hàng", exact: true }),
  ).toBeVisible();
  missing = false;
  failure = {
    match: "owner/restaurant",
    status: 503,
    code: "SERVICE_UNAVAILABLE",
  };
  stickyFailure = true;
  await page.reload();
  const retry = page.getByRole("button", {
    name: "Thử lại thực đơn",
    exact: true,
  });
  await expect(retry).toBeVisible();
  stickyFailure = false;
  failure = null;
  await retry.click();
  await expect(
    page.getByRole("heading", { name: "Bún bò Huế", exact: true }),
  ).toBeVisible();
});
test("proxy enforces session, owner role, Origin and exact method allowlist", async ({
  page,
}) => {
  expect((await page.request.get(base)).status()).toBe(401);
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Bún bò Huế", exact: true }),
  ).toBeVisible();
  const before = calls.length;
  expect(
    (
      await page.request.post(`${base}/14/cancel`, {
        headers: { Origin: "https://attacker.invalid" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(`${base}/14/approve`, {
        headers: { Origin: "http://localhost:3001" },
        data: {},
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.delete(`${base}/0/items/1`, {
        headers: { Origin: "http://localhost:3001" },
      })
    ).status(),
  ).toBe(404);
  expect(calls.length).toBe(before);
  await page.context().clearCookies();
  await login(page, "traveler");
  expect((await page.request.get(base)).status()).toBe(403);
});
test("mobile layout and keyboard modal focus remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await create(page);
  await page.getByRole("button", { name: "Thêm món", exact: true }).click();
  const modal = page.getByRole("dialog", {
    name: "Thêm món vào bản nháp",
    exact: true,
  });
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel("Tên món *", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Thêm món", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: ".cache/menu-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: ".cache/menu-desktop.png", fullPage: true });
});
