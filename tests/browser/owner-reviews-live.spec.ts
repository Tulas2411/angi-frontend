import { createServer, type Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";
import type { RoleCode } from "../../src/features/auth/types";
import { HOME_BY_ROLE } from "../../src/features/auth/roles";
import type { ReviewDto } from "../../src/features/owner/owner-reviews-types";

/**
 * OWN-19 / OWN-20 trên một API stub cục bộ (port 5164).
 *
 * Stub giữ đúng hợp đồng của backend: `GET owner/restaurant/reviews` trả
 * `Paged<ReviewDto>` đã lọc theo `replied`/`rating` và phân trang theo
 * `page`/`pageSize`; `PUT owner/restaurant/reviews/{id}/reply` trả
 * `ReviewReplyDto`, từ chối 404/409 theo trạng thái đánh giá.
 */
let server: Server,
  reviews: ReviewDto[],
  calls: { method: string; path: string; raw: string }[],
  failure: {
    match: string;
    status: number;
    code: string;
    errors?: Record<string, string[]>;
    /** Giữ lỗi cho mọi request khớp cho tới khi test tắt nó. */
    sticky: boolean;
  } | null;

const now = "2026-10-20T02:00:00Z";

function seedReviews(): ReviewDto[] {
  return Array.from({ length: 12 }, (_, index) => ({
    id: 100 + index,
    restaurantId: 7,
    user: {
      id: 200 + index,
      displayName: `Thực khách ${index + 1}`,
      avatarUrl: null,
    },
    rating: (index % 5) + 1,
    content: `Trải nghiệm số ${index + 1} tại nhà hàng`,
    images: [],
    roadmapItemId: null,
    status: index === 5 ? "hidden" : "visible",
    createdAt: new Date(Date.parse(now) - index * 86_400_000).toISOString(),
    reply:
      index % 3 === 0
        ? {
            content: `Cảm ơn thực khách ${index + 1}`,
            status: "visible",
            createdAt: now,
            updatedAt: now,
          }
        : null,
  }));
}

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    const url = new URL(req.url!, "http://127.0.0.1");
    const path = url.pathname.replace("/api/v1/", "");
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
      const role: RoleCode = email.startsWith("traveler")
        ? "TRAVELER"
        : "RESTAURANT_OWNER";
      send(200, {
        accessToken: "reviews-local-access",
        refreshToken: "reviews-local-refresh",
        accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() + 2592000000).toISOString(),
        user: {
          id: 12,
          email,
          displayName: "Chủ nhà hàng",
          avatarUrl: null,
          status: "active",
          needsPreferenceSurvey: null,
          role,
        },
      });
      return;
    }
    if (failure && path.includes(failure.match)) {
      const error = failure;
      if (!error.sticky) failure = null;
      send(error.status, null, error.code, error.errors);
      return;
    }
    if (path === "owner/restaurant/reviews" && req.method === "GET") {
      const replied = url.searchParams.get("replied");
      const rating = url.searchParams.get("rating");
      const page = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      const filtered = reviews.filter((review) => {
        if (replied === "true" && !review.reply) return false;
        if (replied === "false" && review.reply) return false;
        if (rating !== null && review.rating !== Number(rating)) return false;
        return true;
      });
      send(200, {
        items: filtered.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        totalItems: filtered.length,
        totalPages: Math.ceil(filtered.length / pageSize),
      });
      return;
    }
    const reply = path.match(/^owner\/restaurant\/reviews\/(\d+)\/reply$/);
    if (reply && req.method === "PUT") {
      const review = reviews.find((value) => value.id === Number(reply[1]));
      if (!review) {
        send(404, null, "REVIEW_NOT_FOUND");
        return;
      }
      if (review.status !== "visible") {
        send(409, null, "REVIEW_NOT_VISIBLE");
        return;
      }
      const body = JSON.parse(raw) as { content?: string };
      if (!body.content?.trim() || body.content.length > 1000) {
        send(400, null, "VALIDATION_FAILED", {
          Content: ["Nội dung phản hồi không được để trống."],
        });
        return;
      }
      review.reply = {
        content: body.content.trim(),
        status: "visible",
        createdAt: now,
        updatedAt: now,
      };
      send(200, review.reply);
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
  reviews = seedReviews();
  calls = [];
  failure = null;
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

async function login(page: Page, role: RoleCode = "RESTAURANT_OWNER") {
  const email =
    role === "TRAVELER" ? "traveler@reviews.test" : "owner@reviews.test";
  await page.goto("/login");
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Mật khẩu/).fill("TestPassword123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(HOME_BY_ROLE[role]);
}

async function openReviews(page: Page) {
  await login(page);
  await page.goto("/restaurant/reviews");
  await expect(
    page.getByRole("heading", { name: "Lắng nghe thực khách" }),
  ).toBeVisible();
  // Danh sách đã tải xong trước khi test can thiệp vào stub.
  await expect(page.locator(".owner-review").first()).toBeVisible();
}

/** Hai bộ lọc của trang thật (khác với bản minh họa có ba bộ lọc). */
const filters = (page: Page) => page.locator(".owner-reviews-filters select");

test("OWN-19 lists the owner's reviews and forwards the filters to the backend", async ({
  page,
}) => {
  await openReviews(page);
  await expect(page.locator(".owner-review")).toHaveCount(10);
  await expect(page.getByText("12 đánh giá", { exact: true })).toBeVisible();

  // Trang 2 lấy phần còn lại của OWN-19.
  await page.getByRole("button", { name: "Trang sau", exact: true }).click();
  await expect(page.locator(".owner-review")).toHaveCount(2);
  expect(
    calls.some((value) => value.path.includes("page=2&pageSize=10")),
  ).toBe(true);

  // Bộ lọc "chưa phản hồi" gửi `replied=false` và về lại trang đầu.
  await filters(page).first().selectOption("unanswered");
  await expect(page.locator(".owner-review")).toHaveCount(8);
  expect(calls.some((value) => value.path.includes("replied=false"))).toBe(
    true,
  );

  // Bộ lọc số sao gửi `rating`.
  await filters(page).nth(1).selectOption("5");
  await expect(page.locator(".owner-review").first()).toBeVisible();
  expect(calls.some((value) => value.path.includes("rating=5"))).toBe(true);
});

test("OWN-20 saves a reply and shows it on the review", async ({ page }) => {
  await openReviews(page);
  await page.getByRole("button", { name: "Phản hồi", exact: true }).first().click();
  const textarea = page.getByLabel("Phản hồi của nhà hàng");
  await expect(textarea).toBeVisible();

  await textarea.fill("Cảm ơn bạn, Bếp Nhà đã ghi nhận góp ý.");
  await page.getByRole("button", { name: "Lưu phản hồi" }).click();

  await expect(
    page.getByText("Đã gửi phản hồi tới Thực khách 2."),
  ).toBeVisible();
  await expect(
    page.getByText("Cảm ơn bạn, Bếp Nhà đã ghi nhận góp ý."),
  ).toBeVisible();
  const put = calls.find((value) => value.method === "PUT");
  expect(put?.path).toBe("owner/restaurant/reviews/101/reply");
  expect(JSON.parse(put!.raw)).toEqual({
    content: "Cảm ơn bạn, Bếp Nhà đã ghi nhận góp ý.",
  });
});

test("OWN-20 replaces an existing reply and keeps the review in the answered filter", async ({
  page,
}) => {
  await openReviews(page);
  await page
    .getByRole("button", { name: "Sửa phản hồi", exact: true })
    .first()
    .click();
  const textarea = page.getByLabel("Phản hồi của nhà hàng");
  await expect(textarea).toHaveValue("Cảm ơn thực khách 1");
  await textarea.fill("Cảm ơn thực khách 1, hẹn gặp lại.");
  await page.getByRole("button", { name: "Lưu phản hồi" }).click();
  await expect(
    page.getByText("Đã cập nhật phản hồi tới Thực khách 1."),
  ).toBeVisible();
  await expect(
    page.getByText("Cảm ơn thực khách 1, hẹn gặp lại."),
  ).toBeVisible();
});

test("a hidden review cannot be answered and the backend conflict is reported", async ({
  page,
}) => {
  await openReviews(page);
  const hidden = page.locator(".owner-review", { hasText: "Thực khách 6" });
  await expect(hidden.getByText("đang bị ẩn")).toBeVisible();
  await expect(
    hidden.getByRole("button", { name: "Phản hồi", exact: true }),
  ).toBeDisabled();

  // OWN-20 trả 409 khi đánh giá không còn hiển thị.
  failure = {
    match: "/reply",
    status: 409,
    code: "REVIEW_NOT_VISIBLE",
    sticky: true,
  };
  await page.getByRole("button", { name: "Phản hồi", exact: true }).first().click();
  await page
    .getByLabel("Phản hồi của nhà hàng")
    .fill("Xin lỗi về trải nghiệm của bạn.");
  await page.getByRole("button", { name: "Lưu phản hồi" }).click();
  await expect(
    page.getByText("không thể phản hồi", { exact: false }),
  ).toBeVisible();
});

test("a failed list shows an explicit retry instead of an empty page", async ({
  page,
}) => {
  await login(page);
  await page.goto("/restaurant/reviews");
  await expect(page.locator(".owner-review").first()).toBeVisible();
  failure = {
    match: "owner/restaurant/reviews",
    status: 503,
    code: "SERVICE_UNAVAILABLE",
    sticky: true,
  };
  await page.reload();
  await expect(
    page.getByText("Hiện chưa kết nối được với hệ thống.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Thử lại", exact: true }),
  ).toBeVisible();
  failure = null;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.locator(".owner-review").first()).toBeVisible();
});

test("the proxy requires an owner session and the exact allowlisted operations", async ({
  page,
}) => {
  const base = "/api/backend/owner/restaurant/reviews";
  // Chưa đăng nhập: 401.
  expect((await page.request.get(base)).status()).toBe(401);

  await login(page);
  expect((await page.request.get(base)).status()).toBe(200);

  // Sai method, sai id và sai Origin đều không tới được backend.
  const before = calls.length;
  expect(
    (
      await page.request.delete(`${base}/101/reply`, {
        headers: { Origin: "http://localhost:3001" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.put(`${base}/0/reply`, {
        headers: { Origin: "http://localhost:3001" },
        data: { content: "x" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.put(`${base}/101/reply`, {
        headers: { Origin: "https://attacker.invalid" },
        data: { content: "x" },
      })
    ).status(),
  ).toBe(403);
  expect(calls.length).toBe(before);

  // Khách du lịch không được đọc đánh giá của nhà hàng.
  await page.context().clearCookies();
  await login(page, "TRAVELER");
  expect((await page.request.get(base)).status()).toBe(403);
});
