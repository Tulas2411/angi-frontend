import { createServer, type Server } from "node:http";
import { test, expect, type Page } from "@playwright/test";
import type { OwnerRestaurantDto } from "../../src/features/owner/restaurant-types";
import type { SubmitVerificationRequestDto } from "../../src/features/owner/verification-types";
import { HOME_BY_ROLE } from "../../src/features/auth/roles";
import type { RoleCode } from "../../src/features/auth/types";
import { ownerRestaurantSample } from "../fixtures/owner-restaurant";
import {
  verificationRequestSample,
  verificationSample,
} from "../fixtures/restaurant-verification";

let server: Server;
let current: OwnerRestaurantDto | null;
let submissions: SubmitVerificationRequestDto[];
let uploads: { raw: string; contentType: string }[];
let failGet: boolean;
let failUploadAt: number;
let slowSubmit: boolean;
let nextError: {
  status: number;
  errorCode: string;
  errors?: Record<string, string[]>;
} | null;

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
      const role: RoleCode = email.startsWith("traveler")
        ? "TRAVELER"
        : email.startsWith("mod")
          ? "MOD"
          : email.startsWith("admin")
            ? "ADMIN"
            : "RESTAURANT_OWNER";
      send(200, {
        accessToken: "verification-local-access",
        refreshToken: "verification-local-refresh",
        accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() + 2592000000).toISOString(),
        user: {
          id: 12,
          email,
          displayName: "Chủ nhà hàng",
          avatarUrl: null,
          role,
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
      request.url === "/api/v1/owner/restaurant/verifications" &&
      request.method === "GET"
    ) {
      send(
        current ? 200 : 404,
        current
          ? {
              verificationStatus: current.verificationStatus,
              items: current.latestVerification
                ? [current.latestVerification]
                : [],
            }
          : null,
        current ? null : "RESTAURANT_NOT_FOUND",
      );
    } else if (request.url === "/api/v1/media" && request.method === "POST") {
      uploads.push({ raw, contentType: request.headers["content-type"] ?? "" });
      if (uploads.length === failUploadAt)
        send(503, null, "SERVICE_UNAVAILABLE");
      else
        send(201, {
          id: 9000 + uploads.length,
          url: "https://example.invalid/private-upload",
          mimeType: raw.includes("application/pdf")
            ? "application/pdf"
            : "image/jpeg",
          sizeBytes: 30,
          purpose: "verification_doc",
          createdAt: "2026-10-01T00:00:00Z",
        });
    } else if (
      request.url === "/api/v1/owner/restaurant/verifications" &&
      request.method === "POST"
    ) {
      const body = JSON.parse(raw) as SubmitVerificationRequestDto;
      submissions.push(body);
      if (slowSubmit) await new Promise((resolve) => setTimeout(resolve, 700));
      if (nextError) {
        const failure = nextError;
        nextError = null;
        send(failure.status, null, failure.errorCode, failure.errors);
      } else {
        const verification = {
          ...verificationSample,
          ...body,
          taxCode: body.taxCode ?? null,
          ownerNote: body.ownerNote ?? null,
          documents: body.documents.map((document) => ({
            ...document,
            url: "https://example.invalid/private-license.pdf",
          })),
        };
        if (current)
          current = {
            ...current,
            verificationStatus: "pending",
            latestVerification: verification,
          };
        send(201, verification);
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
test.beforeEach(async ({ context }) => {
  current = {
    ...structuredClone(ownerRestaurantSample),
    verificationStatus: "unverified",
  };
  submissions = [];
  uploads = [];
  failGet = false;
  failUploadAt = -1;
  slowSubmit = false;
  nextError = null;
  // Defense in depth: the suite never sends any browser request to a provider.
  await context.route("**/*", async (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === "localhost" || host === "127.0.0.1") await route.continue();
    else await route.abort();
  });
});

const legalName = (page: Page) =>
  page.getByLabel("Tên pháp lý *", { exact: true });
const license = (page: Page) =>
  page.getByLabel("Số giấy phép kinh doanh *", { exact: true });
const addFile = (page: Page) =>
  page.getByLabel("Thêm tài liệu xác minh", { exact: true });
const submit = (page: Page) =>
  page.getByRole("button", { name: "Gửi hồ sơ xác minh", exact: true });
const confirm = (page: Page) =>
  page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận gửi hồ sơ", exact: true });
const pdf = (name = "license.pdf") => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.7 local test only"),
});
async function login(page: Page, role: RoleCode = "RESTAURANT_OWNER") {
  await page.context().clearCookies();
  await page.goto("/login");
  const local =
    role === "TRAVELER"
      ? "traveler"
      : role === "MOD"
        ? "mod"
        : role === "ADMIN"
          ? "admin"
          : "owner";
  await page
    .getByLabel("Email", { exact: true })
    .fill(`${local}@verification.test`);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(HOME_BY_ROLE[role], { timeout: 30000 });
}
async function open(page: Page) {
  await login(page);
  await page.goto("/restaurant/verification");
  await expect(legalName(page)).toBeVisible();
}
async function fill(page: Page) {
  await legalName(page).fill(`  ${verificationRequestSample.legalName}  `);
  await license(page).fill(
    `  ${verificationRequestSample.businessLicenseNo}  `,
  );
}
async function ready(page: Page) {
  await open(page);
  await fill(page);
  await addFile(page).setInputFiles(pdf());
  await expect(page.getByText(/PDF · .*Đã tải lên/)).toBeVisible();
}

test("201 submission uses private multipart uploads and exact wire DTO after a modal; no duplicate or native dialog", async ({
  page,
}) => {
  const native: string[] = [];
  page.on("dialog", async (dialog) => {
    native.push(dialog.type());
    await dialog.dismiss();
  });
  await open(page);
  await submit(page).click();
  await expect(legalName(page)).toBeFocused();
  expect(submissions).toHaveLength(0);
  await fill(page);
  await page
    .getByLabel("Mã số thuế (không bắt buộc)", { exact: true })
    .fill(" 0401234567 ");
  await page
    .getByLabel("Ghi chú gửi người duyệt (không bắt buộc)", { exact: true })
    .fill(" Bổ sung giấy ATTP ");
  await addFile(page).setInputFiles([
    pdf(),
    {
      name: "front.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("local image fixture"),
    },
  ]);
  const type = page.getByLabel("Loại tài liệu · front.jpg", { exact: true });
  await expect(type.locator("option")).toHaveCount(5);
  await type.selectOption("storefront_photo");
  expect(uploads).toHaveLength(2);
  for (const upload of uploads) {
    expect(upload.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(upload.raw).toContain('name="purpose"\r\n\r\nverification_doc');
    expect(upload.raw).toContain('name="file"; filename=');
  }
  await submit(page).click();
  await expect(
    page.getByRole("dialog", { name: "Gửi hồ sơ xác minh?", exact: true }),
  ).toBeVisible();
  expect(submissions).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(submit(page)).toBeFocused();
  await expect(legalName(page)).toHaveValue(
    `  ${verificationRequestSample.legalName}  `,
  );
  await submit(page).click();
  slowSubmit = true;
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/backend/owner/restaurant/verifications") &&
      response.request().method() === "POST",
  );
  await confirm(page).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await response).status()).toBe(201);
  await expect(
    page.getByText("Đã gửi hồ sơ xác minh. Trạng thái: Chờ duyệt.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(submissions).toEqual([
    {
      ...verificationRequestSample,
      documents: [
        { docType: "business_license", mediaId: 9001 },
        { docType: "storefront_photo", mediaId: 9002 },
      ],
    },
  ]);
  await expect(legalName(page)).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hồ sơ gần nhất", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Giấy phép kinh doanh 1", exact: true }),
  ).toHaveAttribute("href", "https://example.invalid/private-license.pdf");
  await page.getByRole("tab", { name: "Hồ sơ xác minh", exact: true }).click();
  await expect(submit(page)).toHaveCount(0);
  expect(native).toEqual([]);
});

test("rejects unsupported files locally, retries partial upload without reuploading successful documents", async ({
  page,
}) => {
  await open(page);
  await fill(page);
  await addFile(page).setInputFiles({
    name: "script.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(
    page.getByText("Chỉ hỗ trợ JPG, PNG, WEBP hoặc PDF.", { exact: true }),
  ).toBeVisible();
  expect(uploads).toHaveLength(0);
  failUploadAt = 2;
  await addFile(page).setInputFiles([pdf("first.pdf"), pdf("second.pdf")]);
  await expect(
    page.getByLabel("Loại tài liệu · first.pdf", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Thử tải lại tài liệu", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Thử tải lại tài liệu", exact: true })
    .click();
  await expect(
    page.getByLabel("Loại tài liệu · second.pdf", { exact: true }),
  ).toBeVisible();
  expect(uploads).toHaveLength(3);
  await page
    .getByLabel("Loại tài liệu · first.pdf", { exact: true })
    .selectOption("other");
  await page
    .getByLabel("Loại tài liệu · second.pdf", { exact: true })
    .selectOption("id_card");
  await submit(page).click();
  await expect(
    page.getByText("Phải có ít nhất một tài liệu loại Giấy phép kinh doanh.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(submissions).toHaveLength(0);
  await page
    .getByLabel("Loại tài liệu · first.pdf", { exact: true })
    .selectOption("business_license");
  await submit(page).click();
  await confirm(page).click();
  await expect(
    page.getByText("Đã gửi hồ sơ xác minh. Trạng thái: Chờ duyệt.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(submissions[0].documents).toEqual([
    { docType: "business_license", mediaId: 9001 },
    { docType: "id_card", mediaId: 9003 },
  ]);
});

test("backend field errors focus the field, retain uploaded IDs and the draft; network failure permits retry", async ({
  page,
}) => {
  await ready(page);
  nextError = {
    status: 400,
    errorCode: "VALIDATION_FAILED",
    errors: {
      LegalName: ["Tên pháp lý cần sửa."],
      "Documents[0].MediaId": ["Tài liệu cần kiểm tra."],
    },
  };
  await submit(page).click();
  await confirm(page).click();
  await expect(
    page.getByText("Tên pháp lý cần sửa.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Tài liệu cần kiểm tra.", { exact: true }),
  ).toBeVisible();
  await expect(legalName(page)).toBeFocused();
  await expect(license(page)).toHaveValue(
    `  ${verificationRequestSample.businessLicenseNo}  `,
  );
  nextError = { status: 503, errorCode: "SERVICE_UNAVAILABLE" };
  await legalName(page).fill("Tên đã sửa");
  await submit(page).click();
  await confirm(page).click();
  await expect(
    page.getByText("Hiện chưa kết nối được với hệ thống.", { exact: true }),
  ).toBeVisible();
  await expect(legalName(page)).toHaveValue("Tên đã sửa");
  await submit(page).click();
  await confirm(page).click();
  await expect(
    page.getByText("Đã gửi hồ sơ xác minh. Trạng thái: Chờ duyệt.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(uploads).toHaveLength(1);
  expect(submissions).toHaveLength(3);
  expect(submissions[2]).toEqual({
    legalName: "Tên đã sửa",
    businessLicenseNo: verificationRequestSample.businessLicenseNo,
    documents: verificationRequestSample.documents,
  });
});

for (const [status, errorCode] of [
  ["pending", "VERIFICATION_ALREADY_PENDING"],
  ["verified", "RESTAURANT_ALREADY_VERIFIED"],
  ["rejected", "VERIFICATION_RESUBMIT_REQUIRED"],
] as const) {
  test(`${status} state is read-only and a concurrent ${errorCode} blocks a second submission`, async ({
    page,
  }) => {
    await ready(page);
    nextError = { status: 409, errorCode };
    if (!current) throw new Error("The test owner fixture is missing.");
    current = {
      ...current,
      verificationStatus: status,
      latestVerification: {
        ...verificationSample,
        status:
          status === "verified"
            ? "approved"
            : status === "rejected"
              ? "needs_more_info"
              : "pending",
      },
    };
    await submit(page).click();
    await confirm(page).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(legalName(page)).toHaveCount(0);
    expect(submissions).toHaveLength(1);
    await page
      .getByRole("button", { name: "Tải lại trạng thái", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", {
        name: "Tải lại và bỏ thay đổi?",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Bỏ thay đổi", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Hồ sơ gần nhất", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("tab", { name: "Hồ sơ xác minh", exact: true })
      .click();
    await expect(submit(page)).toHaveCount(0);
    expect(submissions).toHaveLength(1);
  });
}

test("remove/discard/refresh require modals and mobile layouts stay within the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page
    .getByRole("button", { name: "Bỏ tài liệu license.pdf", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  await expect(
    page.getByLabel("Loại tài liệu · license.pdf", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Bỏ tài liệu license.pdf", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bỏ tài liệu", exact: true })
    .click();
  await expect(
    page.getByLabel("Loại tài liệu · license.pdf", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Hủy thay đổi", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bỏ thay đổi", exact: true })
    .click();
  await expect(legalName(page)).toHaveValue("");
  await legalName(page).fill("Chưa lưu");
  await page
    .getByRole("button", { name: "Tải lại trạng thái", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(legalName(page)).toHaveValue("Chưa lưu");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/verification-mobile.png",
    fullPage: true,
  });
  expect(submissions).toHaveLength(0);
});

test("initial GET failure is retryable and absent restaurants link to registration", async ({
  page,
}) => {
  await login(page);
  failGet = true;
  await page.goto("/restaurant/verification");
  await expect(
    page.getByRole("heading", {
      name: "Chưa tải được hồ sơ nhà hàng",
      exact: true,
    }),
  ).toBeVisible();
  failGet = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(legalName(page)).toBeVisible();
  current = null;
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Bạn chưa đăng ký nhà hàng",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Đăng ký nhà hàng", exact: true }),
  ).toHaveAttribute("href", "/restaurant/register");
});

test("anonymous, wrong roles, foreign Origin and unlisted methods cannot reach OWN-06", async ({
  page,
}) => {
  const url = "/api/backend/owner/restaurant/verifications";
  const headers = { origin: "http://localhost:3001" };
  expect(
    (
      await page.request.post(url, { headers, data: verificationRequestSample })
    ).status(),
  ).toBe(401);
  for (const role of ["TRAVELER", "MOD", "ADMIN"] as const) {
    await login(page, role);
    await page.goto("/restaurant/verification");
    await expect(page).toHaveURL(HOME_BY_ROLE[role]);
    await expect(legalName(page)).toHaveCount(0);
    expect(
      (
        await page.request.post(url, {
          headers,
          data: verificationRequestSample,
        })
      ).status(),
    ).toBe(403);
  }
  await login(page);
  expect(
    (
      await page.request.post(url, {
        headers: { origin: "https://foreign.example" },
        data: verificationRequestSample,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.patch(url, {
        headers,
        data: verificationRequestSample,
      })
    ).status(),
  ).toBe(404);
  expect((await page.request.get(url)).status()).toBe(200);
  expect(submissions).toHaveLength(0);
});

test("demo submits in memory, reflects pending status after refresh and sends no backend calls", async ({
  page,
}) => {
  await page.goto("/dev/scenarios?state=owner-verification-new");
  await expect(legalName(page)).toBeVisible();
  await fill(page);
  await addFile(page).setInputFiles(pdf());
  await expect(
    page.getByLabel("Loại tài liệu · license.pdf", { exact: true }),
  ).toBeVisible();
  await submit(page).click();
  await confirm(page).click();
  await expect(
    page.getByText("Đã gửi hồ sơ minh họa. Trạng thái: Chờ duyệt.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tải lại trạng thái", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hồ sơ gần nhất", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(verificationRequestSample.legalName, { exact: true }),
  ).toBeVisible();
  expect(submissions).toHaveLength(0);
  expect(uploads).toHaveLength(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "artifacts/verification-desktop.png",
    fullPage: true,
  });
});
