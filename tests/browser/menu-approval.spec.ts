import { createServer, type Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";
import type {
  MenuDetailDto,
  MenuSubmissionDto,
} from "../../src/features/owner/menu-types";
import { menuDetailSample, ownerMenuSample } from "../fixtures/restaurant-menu";
import { ownerRestaurantSample } from "../fixtures/owner-restaurant";

let server: Server, detail: MenuDetailDto | null;
let submissions: { id: number; body: unknown }[],
  forwarded: string[],
  external: string[];
let failure: {
  status: number;
  code: string;
  errors?: Record<string, string[]>;
} | null;
const endpoint = "/api/backend/owner/restaurant/menu-submissions/14/submit";
function metadata(value: MenuDetailDto): MenuSubmissionDto {
  const { items, removedDishes, ...rest } = value;
  void items;
  void removedDishes;
  return rest;
}
test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    const path = new URL(req.url!, "http://127.0.0.1").pathname.replace(
      "/api/v1/",
      "",
    );
    forwarded.push(`${req.method} ${path}`);
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
          errorCode: code,
          message: null,
          data,
          errors,
        }),
      );
    };
    if (path === "auth/login") {
      const email = JSON.parse(raw).email as string;
      const role = email.startsWith("traveler")
        ? "TRAVELER"
        : email.startsWith("mod")
          ? "MOD"
          : email.startsWith("admin")
            ? "ADMIN"
            : "RESTAURANT_OWNER";
      send(200, {
        accessToken: "approval-local-access",
        refreshToken: "approval-local-refresh",
        accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() + 2592000000).toISOString(),
        user: {
          id: 12,
          email,
          role,
          displayName: "Chủ nhà hàng",
          avatarUrl: null,
          status: "active",
          needsPreferenceSurvey: null,
        },
      });
      return;
    }
    if (path === "owner/restaurant") {
      send(200, { ...ownerRestaurantSample, verificationStatus: "verified" });
      return;
    }
    if (path === "owner/restaurant/menu") {
      send(200, {
        ...ownerMenuSample,
        openSubmission:
          detail && (detail.status === "draft" || detail.status === "pending")
            ? { id: detail.id, status: detail.status }
            : null,
      });
      return;
    }
    if (path === "owner/restaurant/menu-submissions") {
      send(200, {
        items: detail ? [metadata(detail)] : [],
        page: 1,
        pageSize: 5,
        totalItems: detail ? 1 : 0,
        totalPages: detail ? 1 : 0,
      });
      return;
    }
    if (path === "owner/restaurant/menu-submissions/14") {
      send(detail ? 200 : 404, detail, detail ? null : "SUBMISSION_NOT_FOUND");
      return;
    }
    if (
      path === "owner/restaurant/menu-submissions/14/submit" &&
      req.method === "POST"
    ) {
      submissions.push({ id: 14, body: JSON.parse(raw) });
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (failure) {
        const error = failure;
        failure = null;
        if (error.code === "SUBMISSION_NOT_EDITABLE" && detail)
          detail.status = "pending";
        if (error.code === "SUBMISSION_NOT_FOUND") detail = null;
        if (error.code === "MENU_EMPTY" && detail) detail.items = [];
        if (error.code === "MENU_UNCHANGED" && detail)
          detail.items.forEach((item) => {
            item.change = "unchanged";
          });
        send(error.status, null, error.code, error.errors);
        return;
      }
      if (!detail) {
        send(404, null, "SUBMISSION_NOT_FOUND");
        return;
      }
      if (detail.status !== "draft") {
        send(409, null, "SUBMISSION_NOT_EDITABLE");
        return;
      }
      detail.status = "pending";
      detail.ownerNote = JSON.parse(raw).ownerNote ?? null;
      detail.submittedAt = "2026-10-17T02:00:00Z";
      send(200, metadata(detail));
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
  detail = structuredClone(menuDetailSample);
  detail.items[0].change = "edited";
  detail.items[0].price = 55000;
  submissions = [];
  forwarded = [];
  failure = null;
  external = [];
  page.on("dialog", async (dialog) => {
    await dialog.dismiss();
    throw new Error("Native dialog is prohibited");
  });
  await context.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    if (["localhost", "127.0.0.1"].includes(host)) return route.continue();
    external.push(host);
    return route.abort();
  });
});
async function login(page: Page, role = "owner") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(`${role}@approval.test`);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
async function open(page: Page) {
  await login(page);
  await page.goto("/restaurant/menu");
  await page
    .getByRole("button", { name: "Mở bản thực đơn", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Gửi duyệt thực đơn", exact: true }),
  ).toBeVisible();
}
async function modal(page: Page) {
  await page
    .getByRole("button", { name: "Gửi duyệt thực đơn", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Gửi thực đơn để duyệt?",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  return dialog;
}
test("confirmation sends one exact OWN17 request, applies pending metadata and preserves the active menu/history", async ({
  page,
}) => {
  await open(page);
  const dialog = await modal(page);
  await dialog
    .getByLabel("Ghi chú gửi kiểm duyệt", { exact: true })
    .fill("  Tăng giá món  ");
  await dialog.getByRole("button", { name: "Để sau", exact: true }).click();
  expect(submissions).toEqual([]);
  await modal(page);
  await expect(
    dialog.getByLabel("Ghi chú gửi kiểm duyệt", { exact: true }),
  ).toHaveValue("  Tăng giá món  ");
  const response = page.waitForResponse((value) =>
    value.url().endsWith(endpoint),
  );
  await dialog
    .getByRole("button", { name: "Xác nhận gửi duyệt", exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  expect((await response).status()).toBe(200);
  await expect(
    page.getByText("Đã gửi thực đơn để duyệt. Trạng thái: Chờ duyệt.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(submissions).toEqual([
    { id: 14, body: { ownerNote: "Tăng giá món" } },
  ]);
  await expect(
    page.getByRole("button", { name: "Sửa Bún bò Huế", exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Gửi duyệt thực đơn", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("tab", { name: "Đang bán", exact: true }).click();
  await expect(page.getByText(/45\.000/)).toBeVisible();
  await page.getByRole("tab", { name: "Lịch sử", exact: true }).click();
  await page.getByRole("button", { name: "Xem bản #14", exact: true }).click();
  await expect(page.getByText("Tăng giá món", { exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Mở bản thực đơn", exact: true })
    .click();
  await expect(page.getByText("Chờ duyệt", { exact: true })).toBeVisible();
  expect(external.filter((host) => /mapbox/i.test(host))).toEqual([]);
});
for (const note of ["", "x".repeat(1000)])
  test(`optional note ${note ? "at 1000-character boundary" : "omitted"} is accepted`, async ({
    page,
  }) => {
    await open(page);
    const dialog = await modal(page);
    if (note)
      await dialog
        .getByLabel("Ghi chú gửi kiểm duyệt", { exact: true })
        .fill(note);
    await dialog
      .getByRole("button", { name: "Xác nhận gửi duyệt", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    expect(submissions[0].body).toEqual(note ? { ownerNote: note } : {});
  });
for (const error of [
  {
    status: 400,
    code: "VALIDATION_FAILED",
    errors: { OwnerNote: ["Ghi chú bị từ chối để kiểm thử."] },
  },
  { status: 503, code: "SERVICE_UNAVAILABLE" },
])
  test(`${error.code} preserves the note and allows an explicit retry`, async ({
    page,
  }) => {
    await open(page);
    const dialog = await modal(page);
    await dialog
      .getByLabel("Ghi chú gửi kiểm duyệt", { exact: true })
      .fill("Giữ ghi chú khi lỗi");
    failure = error;
    await dialog
      .getByRole("button", { name: "Xác nhận gửi duyệt", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(
      dialog.getByLabel("Ghi chú gửi kiểm duyệt", { exact: true }),
    ).toHaveValue("Giữ ghi chú khi lỗi");
    expect(detail?.status).toBe("draft");
    if (error.code === "VALIDATION_FAILED")
      await expect(
        dialog.getByLabel("Ghi chú gửi kiểm duyệt", { exact: true }),
      ).toBeFocused();
    await dialog
      .getByRole("button", { name: "Xác nhận gửi duyệt", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    expect(submissions).toHaveLength(2);
  });
for (const code of [
  "MENU_EMPTY",
  "MENU_UNCHANGED",
  "SUBMISSION_NOT_EDITABLE",
  "SUBMISSION_NOT_FOUND",
])
  test(`${code} does not report success and refresh obtains authoritative state`, async ({
    page,
  }) => {
    await open(page);
    const dialog = await modal(page);
    await dialog
      .getByLabel("Ghi chú gửi kiểm duyệt", { exact: true })
      .fill("Ghi chú vẫn giữ");
    failure = {
      status:
        code === "SUBMISSION_NOT_FOUND"
          ? 404
          : code === "SUBMISSION_NOT_EDITABLE"
            ? 409
            : 400,
      code,
    };
    await dialog
      .getByRole("button", { name: "Xác nhận gửi duyệt", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(
      dialog.getByLabel("Ghi chú gửi kiểm duyệt", { exact: true }),
    ).toHaveValue("Ghi chú vẫn giữ");
    await expect(
      page.getByText("Đã gửi thực đơn để duyệt. Trạng thái: Chờ duyệt.", {
        exact: true,
      }),
    ).not.toBeVisible();
    await dialog
      .getByRole("button", {
        name: "Đóng và tải lại bản thực đơn",
        exact: true,
      })
      .click();
    await expect(dialog).not.toBeVisible();
    if (code === "SUBMISSION_NOT_EDITABLE")
      await expect(page.getByText("Chờ duyệt", { exact: true })).toBeVisible();
    else if (code === "SUBMISSION_NOT_FOUND")
      await expect(
        page.getByRole("button", { name: "Tải lại bản thực đơn", exact: true }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("button", { name: "Gửi duyệt thực đơn", exact: true }),
      ).toBeDisabled();
    expect(submissions).toHaveLength(1);
  });
test("empty/unchanged drafts cannot submit; non-draft history stays readonly", async ({
  page,
}) => {
  detail!.items[0].change = "unchanged";
  await open(page);
  await expect(
    page.getByRole("button", { name: "Gửi duyệt thực đơn", exact: true }),
  ).toBeDisabled();
  detail!.items = [];
  await page.reload();
  await page
    .getByRole("button", { name: "Mở bản thực đơn", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Gửi duyệt thực đơn", exact: true }),
  ).toBeDisabled();
  expect(submissions).toEqual([]);
  for (const status of [
    "pending",
    "approved",
    "rejected",
    "cancelled",
  ] as const) {
    detail!.status = status;
    await page.reload();
    await page.getByRole("tab", { name: "Lịch sử", exact: true }).click();
    await page
      .getByRole("button", { name: "Xem bản #14", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Gửi duyệt thực đơn", exact: true }),
    ).not.toBeVisible();
  }
});
test("proxy denies anonymous, other roles, foreign origins, invalid IDs and wrong methods", async ({
  page,
}) => {
  const headers = { Origin: "http://localhost:3001" };
  expect(
    (await page.request.post(endpoint, { headers, data: {} })).status(),
  ).toBe(401);
  await login(page);
  await page.goto("/restaurant/menu");
  await expect(
    page.getByRole("heading", { name: "Bún bò Huế", exact: true }),
  ).toBeVisible();
  const before = forwarded.filter((value) => value.endsWith("/submit")).length;
  expect(
    (
      await page.request.post(endpoint, {
        headers: { Origin: "https://attacker.invalid" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect((await page.request.get(endpoint)).status()).toBe(404);
  expect(
    (await page.request.put(endpoint, { headers, data: {} })).status(),
  ).toBe(404);
  expect(
    (
      await page.request.post(endpoint.replace("/14/", "/0/"), {
        headers,
        data: {},
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.post(`${endpoint}/extra`, { headers, data: {} })
    ).status(),
  ).toBe(404);
  expect(forwarded.filter((value) => value.endsWith("/submit")).length).toBe(
    before,
  );
  for (const role of ["traveler", "mod", "admin"]) {
    await page.context().clearCookies();
    await login(page, role);
    expect(
      (await page.request.post(endpoint, { headers, data: {} })).status(),
    ).toBe(403);
  }
});
test("mobile modal supports keyboard, retained notes across history navigation, no overflow and focus return", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  let dialog = await modal(page);
  await expect(
    dialog.getByLabel("Ghi chú gửi kiểm duyệt", { exact: true }),
  ).toBeFocused();
  await dialog
    .getByLabel("Ghi chú gửi kiểm duyệt", { exact: true })
    .fill("Giữ ghi chú khi xem lịch sử");
  await page.screenshot({
    path: ".cache/menu-approval-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Gửi duyệt thực đơn", exact: true }),
  ).toBeFocused();
  await page.getByRole("tab", { name: "Lịch sử", exact: true }).click();
  await page.getByRole("button", { name: "Xem bản #14", exact: true }).click();
  dialog = await modal(page);
  await expect(
    dialog.getByLabel("Ghi chú gửi kiểm duyệt", { exact: true }),
  ).toHaveValue("Giữ ghi chú khi xem lịch sử");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: ".cache/menu-approval-desktop.png",
    fullPage: true,
  });
});
test("demo submits the same draft locally without authenticating or contacting backend", async ({
  page,
}) => {
  await page.goto("/demo/owner/menu");
  await page.getByRole("button", { name: "Tạo bản nháp", exact: true }).click();
  await page.getByRole("button", { name: "Sửa Phở bò", exact: true }).click();
  const editor = page.getByRole("dialog", {
    name: "Sửa món trong bản nháp",
    exact: true,
  });
  await editor.getByLabel("Giá (VND) *", { exact: true }).fill("65001");
  await editor.getByRole("button", { name: "Lưu món", exact: true }).click();
  const dialog = await modal(page);
  await dialog
    .getByLabel("Ghi chú gửi kiểm duyệt", { exact: true })
    .fill("Ghi chú minh họa");
  await dialog
    .getByRole("button", { name: "Xác nhận gửi duyệt", exact: true })
    .click();
  await expect(page.getByText("Chờ duyệt", { exact: true })).toBeVisible();
  expect(submissions).toEqual([]);
  expect(forwarded).toEqual([]);
  await expect(page.getByText(/Bản minh họa\. Thay đổi chỉ lưu/)).toBeVisible();
});
