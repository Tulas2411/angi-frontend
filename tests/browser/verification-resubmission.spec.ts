import { createServer, type Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";
import { ownerRestaurantSample } from "../fixtures/owner-restaurant";
import { verificationHistoryFixture } from "../fixtures/verification-history";
import type {
  GetVerificationStatusResponseDto,
  ResubmitVerificationRequestDto,
} from "../../src/features/owner/verification-types";

let server: Server;
let history: GetVerificationStatusResponseDto;
let submissions: { id: number; body: ResubmitVerificationRequestDto }[];
let uploads: number;
let failure: {
  status: number;
  code: string;
  errors?: Record<string, string[]>;
} | null;
let external: string[];
const endpoint = "/api/backend/owner/restaurant/verifications/23/resubmit";

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    const send = (
      status: number,
      data: unknown,
      code: string | null = null,
      errors?: Record<string, string[]>,
    ) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          success: status < 400,
          message: null,
          errorCode: code,
          data,
          errors,
        }),
      );
    };
    if (request.url === "/api/v1/auth/login") {
      const { email } = JSON.parse(raw) as { email: string };
      const role = email.startsWith("traveler")
        ? "TRAVELER"
        : email.startsWith("mod")
          ? "MOD"
          : email.startsWith("admin")
            ? "ADMIN"
            : "RESTAURANT_OWNER";
      send(200, {
        accessToken: "resubmit-local-access",
        refreshToken: "resubmit-local-refresh",
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
    } else if (
      request.url === "/api/v1/owner/restaurant" &&
      request.method === "GET"
    ) {
      send(200, {
        ...ownerRestaurantSample,
        verificationStatus: history.verificationStatus,
        latestVerification: history.items[0],
      });
    } else if (
      request.url === "/api/v1/owner/restaurant/verifications" &&
      request.method === "GET"
    ) {
      send(200, history);
    } else if (request.url === "/api/v1/media" && request.method === "POST") {
      uploads++;
      expect(raw).toContain('name="purpose"\r\n\r\nverification_doc');
      send(201, {
        id: 9001 + uploads,
        url: "https://example.invalid/private-new.pdf",
        purpose: "verification_doc",
        mimeType: "application/pdf",
        sizeBytes: 50,
        createdAt: new Date().toISOString(),
      });
    } else if (
      request.url === "/api/v1/owner/restaurant/verifications/23/resubmit" &&
      request.method === "POST"
    ) {
      const body = JSON.parse(raw) as ResubmitVerificationRequestDto;
      submissions.push({ id: 23, body });
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (failure) {
        const result = failure;
        failure = null;
        send(result.status, null, result.code, result.errors);
      } else {
        const result = {
          ...history.items[0],
          ...body,
          taxCode: body.taxCode ?? null,
          ownerNote: body.ownerNote ?? null,
          id: 24,
          previousId: 23,
          status: "pending" as const,
          submittedAt: new Date().toISOString(),
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: null,
          documents: body.documents.map((document) => ({
            ...document,
            url: "https://example.invalid/private-new.pdf",
          })),
        };
        history = {
          verificationStatus: "pending",
          items: [result, ...history.items],
        };
        send(201, result);
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
test.beforeEach(async ({ context, page }) => {
  history = verificationHistoryFixture("needs_more_info");
  history.items[0].documents[0].url = "https://example.invalid/retained.pdf";
  submissions = [];
  uploads = 0;
  failure = null;
  external = [];
  page.on("dialog", async (dialog) => {
    await dialog.dismiss();
    throw new Error("Unexpected native dialog");
  });
  await context.route("**/*", async (route) => {
    const host = new URL(route.request().url()).hostname;
    if (["localhost", "127.0.0.1"].includes(host)) await route.continue();
    else {
      external.push(host);
      await route.abort();
    }
  });
});
async function login(page: Page, name = "owner") {
  await page.goto("/login");
  await page.getByLabel(/^Email/).fill(`${name}@resubmit.test`);
  await page.getByLabel(/^Mật khẩu/).fill("TestPassword123");
  const response = page.waitForResponse((response) =>
    response.url().endsWith("/api/auth/login"),
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).not.toHaveURL(/\/login$/);
}
const legal = (page: Page) => page.getByLabel("Tên pháp lý *", { exact: true });
const submit = (page: Page) =>
  page.getByRole("button", { name: "Gửi lại hồ sơ xác minh", exact: true });
async function open(page: Page) {
  await login(page);
  await page.goto("/restaurant/verification?tab=status");
  await page
    .getByRole("button", { name: "Gửi lại hồ sơ", exact: true })
    .click();
  await expect(legal(page)).toBeVisible();
}
async function confirm(page: Page) {
  await submit(page).click();
  const dialog = page.getByRole("dialog", {
    name: "Gửi lại hồ sơ xác minh?",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Xác nhận gửi lại hồ sơ", exact: true })
    .click();
}

test("needs_more_info prefills the complete dossier; replacing documents sends the exact OWN-08 DTO after confirmation", async ({
  page,
}) => {
  await open(page);
  await expect(legal(page)).toHaveValue(history.items[0].legalName);
  await expect(legal(page)).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Mở tài liệu #9001", exact: true }),
  ).toHaveAttribute("href", "https://example.invalid/retained.pdf");
  await expect(
    page.getByText(history.items[0].reviewNote!, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Bỏ tài liệu Tài liệu đã gửi #9001",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bỏ tài liệu", exact: true })
    .click();
  await submit(page).click();
  await expect(
    page.getByText("Chọn ít nhất một tài liệu cho lần gửi lại.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Thêm tài liệu xác minh", { exact: true })
    .setInputFiles({
      name: "attp.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 local fixture"),
    });
  await expect(page.getByText(/PDF · .*Đã tải lên/)).toBeVisible();
  await page
    .getByLabel("Loại tài liệu · attp.pdf", { exact: true })
    .selectOption("food_safety_cert");
  await legal(page).fill(" Tên pháp lý mới ");
  await page
    .getByLabel("Ghi chú gửi người duyệt (không bắt buộc)", { exact: true })
    .fill(" Đã bổ sung giấy ATTP theo yêu cầu ");
  await submit(page).click();
  expect(submissions).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(submit(page)).toBeFocused();
  await page.screenshot({
    path: "artifacts/verification-resubmission-desktop.png",
    fullPage: true,
  });
  const saved = page.waitForResponse((response) =>
    response.url().endsWith(endpoint),
  );
  await confirm(page);
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await saved).status()).toBe(201);
  await expect(
    page.getByText("Đã gửi lại hồ sơ xác minh. Trạng thái: Chờ duyệt.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(submissions).toEqual([
    {
      id: 23,
      body: {
        legalName: "Tên pháp lý mới",
        businessLicenseNo: "32A8012345",
        taxCode: "0401234567",
        ownerNote: "Đã bổ sung giấy ATTP theo yêu cầu",
        documents: [{ docType: "food_safety_cert", mediaId: 9002 }],
      },
    },
  ]);
  expect(uploads).toBe(1);
  expect(history.items[0].previousId).toBe(23);
  expect(history.items[1].status).toBe("needs_more_info");
  await expect(
    page.getByRole("button", { name: "Gửi lại hồ sơ", exact: true }),
  ).toHaveCount(0);
  expect(external).toEqual([]);
});

test("rejected dossier reuses retained documents without uploading or changing previous feedback; reload keeps the pending result", async ({
  page,
}) => {
  history = verificationHistoryFixture("rejected");
  const previous = structuredClone(history.items[0]);
  await open(page);
  await confirm(page);
  await expect(
    page.getByText("Đã gửi lại hồ sơ xác minh. Trạng thái: Chờ duyệt.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(uploads).toBe(0);
  expect(history.items[1]).toEqual(previous);
  expect(submissions[0].body.documents).toEqual([
    { docType: "business_license", mediaId: 9001 },
  ]);
  await page.reload();
  await page
    .getByRole("button", { name: "Xem hồ sơ #24", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xem hồ sơ trước #23", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText(previous.reviewNote!, { exact: true }),
  ).toBeVisible();
  expect(external).toEqual([]);
});

test("400 indexed errors focus the field; 503 preserves the draft and retained IDs for retry", async ({
  page,
}) => {
  await open(page);
  failure = {
    status: 400,
    code: "VALIDATION_FAILED",
    errors: {
      LegalName: ["Tên cần sửa."],
      "Documents[0].MediaId": ["Tài liệu cần kiểm tra."],
    },
  };
  await confirm(page);
  await expect(page.getByText("Tên cần sửa.", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Tài liệu cần kiểm tra.", { exact: true }),
  ).toBeVisible();
  await expect(legal(page)).toBeFocused();
  await legal(page).fill("Tên đã sửa");
  failure = { status: 503, code: "SERVICE_UNAVAILABLE" };
  await confirm(page);
  await expect(
    page.getByText("Hiện chưa kết nối được với hệ thống.", { exact: true }),
  ).toBeVisible();
  await expect(legal(page)).toHaveValue("Tên đã sửa");
  await confirm(page);
  await expect(
    page.getByText("Đã gửi lại hồ sơ xác minh. Trạng thái: Chờ duyệt.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(uploads).toBe(0);
  expect(submissions).toHaveLength(3);
});

for (const [status, code] of [
  [409, "VERIFICATION_NOT_RESUBMITTABLE"],
  [404, "VERIFICATION_NOT_FOUND"],
] as const) {
  test(`${code} blocks repeated resubmission and refresh uses current server eligibility`, async ({
    page,
  }) => {
    await open(page);
    failure = { status, code };
    await confirm(page);
    await expect(submit(page)).toHaveCount(0);
    expect(submissions).toHaveLength(1);
    history = verificationHistoryFixture("pending");
    await page
      .getByRole("button", { name: "Tải lại lịch sử", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Gửi lại hồ sơ", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "Gửi lại hồ sơ", exact: true }).click();
    await expect(submit(page)).toHaveCount(0);
    expect(submissions).toHaveLength(1);
  });
}

test("draft survives status navigation and modal cancellation; discard/reload use modals on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await legal(page).fill("Bản nháp đang chỉnh");
  await page
    .getByRole("tab", { name: "Trạng thái xác minh", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Gửi lại hồ sơ", exact: true })
    .click();
  await expect(legal(page)).toHaveValue("Bản nháp đang chỉnh");
  await page
    .getByRole("button", { name: "Tải lại trạng thái", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Tải lại và bỏ thay đổi?", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(legal(page)).toHaveValue("Bản nháp đang chỉnh");
  await page.screenshot({
    path: "artifacts/verification-resubmission-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Hủy thay đổi", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bỏ thay đổi", exact: true })
    .click();
  await expect(legal(page)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Gửi lại hồ sơ", exact: true })
    .click();
  await expect(legal(page)).toHaveValue(history.items[0].legalName);
  expect(submissions).toHaveLength(0);
});

test("proxy denies unauthenticated/non-owner requests, bad ids, methods and foreign origins without forwarding", async ({
  page,
}) => {
  expect(
    (
      await page.request.post(endpoint, {
        headers: { Origin: "http://localhost:3001" },
        data: {},
      })
    ).status(),
  ).toBe(401);
  for (const name of ["traveler", "mod", "admin"]) {
    await page.context().clearCookies();
    await login(page, name);
    expect(
      (
        await page.request.post(endpoint, {
          headers: { Origin: "http://localhost:3001" },
          data: {},
        })
      ).status(),
    ).toBe(403);
  }
  await page.context().clearCookies();
  await login(page);
  for (const id of ["0", "abc", "23x"]) {
    expect(
      (
        await page.request.post(endpoint.replace("/23/", `/${id}/`), {
          headers: { Origin: "http://localhost:3001" },
          data: {},
        })
      ).status(),
    ).toBe(404);
  }
  expect((await page.request.get(endpoint)).status()).toBe(404);
  expect(
    (
      await page.request.post(endpoint, {
        headers: { Origin: "https://foreign.invalid" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(submissions).toHaveLength(0);
});
