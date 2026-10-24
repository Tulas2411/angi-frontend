import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { ApiResponse } from "../../src/shared/types/api";
import type {
  GetVerificationStatusResponseDto,
  VerificationDto,
} from "../../src/features/owner/verification-types";

const origin = "http://localhost:3001";
const endpoint = "/api/backend/owner/restaurant/verifications";
const evidence: Record<string, unknown> = {
  checkedAt: new Date().toISOString(),
  run: process.env.ANGI_LOCAL_TEST_RUN,
};

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.ANGI_TEST_PASSWORD!);
  const result = page.waitForResponse((response) =>
    response.url().endsWith("/api/auth/login"),
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  expect((await result).status()).toBe(200);
  await expect(page).toHaveURL(/\/restaurant$/);
}

test.beforeEach(async ({ context }) => {
  // Only real same-origin FE/BE requests are allowed. No external browser fetches.
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["localhost", "127.0.0.1"].includes(url.hostname))
      await route.continue();
    else await route.abort();
  });
});

test.afterEach(async ({ page }) => {
  await page.request.post("/api/auth/logout", { headers: { Origin: origin } });
});

test.afterAll(async () => {
  await mkdir("artifacts", { recursive: true });
  const path = "artifacts/verification-live-evidence.json";
  const previous = JSON.parse(await readFile(path, "utf8").catch(() => "{}"));
  // Only status codes, counts and synthetic record IDs. No credentials/private URLs.
  // A failed test restarts the worker; preserve other results from this exact run.
  await writeFile(
    path,
    JSON.stringify(
      { ...(previous.run === evidence.run ? previous : {}), ...evidence },
      null,
      2,
    ),
  );
});

test("real BE: an owner without a restaurant receives 404 and sees registration guidance", async ({
  page,
}) => {
  await login(page, process.env.ANGI_TEST_EMPTY_OWNER_EMAIL!);
  const response = await page.request.get(endpoint);
  expect(response.status()).toBe(404);
  expect((await response.json()).errorCode).toBe("RESTAURANT_NOT_FOUND");
  await page.goto("/restaurant/verification?tab=status");
  await expect(
    page.getByRole("heading", {
      name: "Bạn chưa đăng ký nhà hàng",
      exact: true,
    }),
  ).toBeVisible();
  evidence.missingRestaurant = { status: 404, guidanceVisible: true };
});

test("real BE: private upload, confirmed submission and pending history persist after reload", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  const nativeDialogs: string[] = [];
  let mapboxRequests = 0;
  page.on("pageerror", (error) => pageErrors.push(error.name));
  page.on("request", (request) => {
    if (/mapbox/i.test(new URL(request.url()).hostname)) mapboxRequests++;
  });
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.type());
    await dialog.dismiss();
  });
  await login(page, process.env.ANGI_TEST_OWNER_EMAIL!);
  const created = await page.request.post("/api/backend/owner/restaurant", {
    headers: { Origin: origin },
    data: {
      name: `Verification test ${process.env.ANGI_LOCAL_TEST_RUN}`,
      phone: "0901234567",
      addressLine: "24 Nguyễn Hữu Huân",
      provinceName: "Thành phố Hà Nội",
      latitude: 21.0285,
      longitude: 105.8542,
    },
  });
  expect(created.status()).toBe(201);
  await page.goto("/restaurant/verification?tab=status");
  await expect(
    page.getByRole("heading", { name: "Chưa có hồ sơ xác minh", exact: true }),
  ).toBeVisible();
  const empty = await page.request.get(endpoint);
  expect(empty.status()).toBe(200);
  expect((await empty.json()).data).toEqual({
    verificationStatus: "unverified",
    items: [],
  });

  const invalid = await page.request.post(endpoint, {
    headers: { Origin: origin },
    data: { legalName: "", businessLicenseNo: "", documents: [] },
  });
  expect(invalid.status()).toBe(400);

  await page.getByRole("tab", { name: "Hồ sơ xác minh", exact: true }).click();
  await page
    .getByLabel("Tên pháp lý *", { exact: true })
    .fill("Hộ kinh doanh kiểm thử ANGI");
  await page
    .getByLabel("Số giấy phép kinh doanh *", { exact: true })
    .fill("TEST-ANGI-65");
  await page
    .getByLabel("Ghi chú gửi người duyệt (không bắt buộc)", { exact: true })
    .fill("Tài liệu tổng hợp dùng để kiểm thử, không phải giấy phép thật.");
  const uploadResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/backend/media") &&
      response.request().method() === "POST",
  );
  await page
    .getByLabel("Thêm tài liệu xác minh", { exact: true })
    .setInputFiles({
      name: "angi-verification-test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n"),
    });
  const upload = await uploadResponse;
  evidence.upload = { status: upload.status() };
  expect(upload.status()).toBe(201);
  const media = (await upload.json()).data;
  expect(media.purpose).toBe("verification_doc");
  await expect(page.getByText(/PDF · .*Đã tải lên/)).toBeVisible();
  await page
    .getByRole("button", { name: "Gửi hồ sơ xác minh", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Gửi hồ sơ xác minh?",
    exact: true,
  });
  await expect(modal).toBeVisible();
  const submissionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(endpoint) &&
      response.request().method() === "POST",
  );
  await modal
    .getByRole("button", { name: "Xác nhận gửi hồ sơ", exact: true })
    .click();
  const submission = await submissionResponse;
  expect(submission.status()).toBe(201);
  const submitted = ((await submission.json()) as ApiResponse<VerificationDto>)
    .data!;
  expect(submitted.status).toBe("pending");
  expect(
    submitted.documents.map(({ mediaId, docType }) => ({ mediaId, docType })),
  ).toEqual([{ mediaId: media.id, docType: "business_license" }]);
  await expect(
    page.getByText("Đã gửi hồ sơ xác minh. Trạng thái: Chờ duyệt.", {
      exact: true,
    }),
  ).toBeVisible();

  await page
    .getByRole("tab", { name: "Trạng thái xác minh", exact: true })
    .click();
  const latest = page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "Hồ sơ gần nhất", exact: true }),
  });
  await expect(
    latest.getByText("Hộ kinh doanh kiểm thử ANGI", { exact: true }),
  ).toBeVisible();
  const historyResponse = await page.request.get(endpoint);
  expect(historyResponse.status()).toBe(200);
  const history = (
    (await historyResponse.json()) as ApiResponse<GetVerificationStatusResponseDto>
  ).data!;
  expect(history.verificationStatus).toBe("pending");
  expect(history.items).toHaveLength(1);
  expect(history.items[0].id).toBe(submitted.id);
  expect(history.items[0].reviewedBy).toBeNull();
  expect(history.items[0].reviewNote).toBeNull();
  await expect(
    latest.getByText("Chưa có phản hồi.", { exact: true }),
  ).toBeVisible();

  await page.reload();
  await page
    .getByRole("button", { name: `Xem hồ sơ #${submitted.id}`, exact: true })
    .click();
  const detail = page.getByRole("dialog", {
    name: `Chi tiết hồ sơ #${submitted.id}`,
    exact: true,
  });
  await expect(detail.getByText("TEST-ANGI-65", { exact: true })).toBeVisible();
  const documentUrl = history.items[0].documents[0].url;
  // Compare booleans so a failure cannot print a private signed URL.
  expect(
    (await detail
      .getByRole("link", { name: "Giấy phép kinh doanh 1", exact: true })
      .getAttribute("href")) === documentUrl,
  ).toBe(true);
  await page.keyboard.press("Escape");
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().endsWith(endpoint) &&
      response.request().method() === "GET",
  );
  await page
    .getByRole("button", { name: "Tải lại lịch sử", exact: true })
    .click();
  expect((await refreshed).status()).toBe(200);
  await expect(latest.getByText("TEST-ANGI-65", { exact: true })).toBeVisible();
  const duplicate = await page.request.post(endpoint, {
    headers: { Origin: origin },
    data: {
      legalName: "Hộ kinh doanh kiểm thử ANGI",
      businessLicenseNo: "TEST-ANGI-65",
      documents: [{ docType: "business_license", mediaId: media.id }],
    },
  });
  expect(duplicate.status()).toBe(409);
  expect((await duplicate.json()).errorCode).toBe(
    "VERIFICATION_ALREADY_PENDING",
  );
  evidence.workflow = {
    registration: 201,
    invalidSubmission: 400,
    submission: 201,
    history: 200,
    verificationId: submitted.id,
    mediaId: media.id,
    state: "pending",
    historyCount: 1,
    reloadPersisted: true,
    duplicate: 409,
  };

  // One explicit download of our synthetic private document; never a Mapbox call.
  const privateUrl = new URL(documentUrl);
  // BE uses the signed private-download API, which can use api.cloudinary.com.
  expect(
    ["api.cloudinary.com", "res.cloudinary.com"].includes(privateUrl.hostname),
  ).toBe(true);
  const document = await page.request.get(documentUrl);
  evidence.privateDocument = {
    status: document.status(),
    contentType: document.headers()["content-type"],
  };
  expect(document.status()).toBe(200);
  expect((await document.body()).subarray(0, 5).toString()).toBe("%PDF-");
  expect(pageErrors).toEqual([]);
  expect(nativeDialogs).toEqual([]);
  expect(mapboxRequests).toBe(0);
  evidence.browser = {
    pageErrors: pageErrors.length,
    nativeDialogs: nativeDialogs.length,
    mapboxRequests,
  };
});

test("real BE: anonymous and traveler requests cannot access owner verification history", async ({
  request,
}) => {
  const anonymous = await request.get(endpoint);
  expect(anonymous.status()).toBe(401);
  const loginResult = await request.post("/api/auth/login", {
    headers: { Origin: origin },
    data: {
      email: "traveler@angi.local",
      password: process.env.ANGI_TEST_PASSWORD,
    },
  });
  expect(loginResult.status()).toBe(200);
  const forbidden = await request.get(endpoint);
  expect(forbidden.status()).toBe(403);
  expect((await forbidden.json()).errorCode).toBe("FORBIDDEN");
  await request.post("/api/auth/logout", { headers: { Origin: origin } });

  const api = process.env.API_BASE_URL;
  const directAnonymous = await request.get(
    `${api}/owner/restaurant/verifications`,
  );
  expect(directAnonymous.status()).toBe(401);
  const directLogin = await request.post(`${api}/auth/login`, {
    data: {
      email: "traveler@angi.local",
      password: process.env.ANGI_TEST_PASSWORD,
    },
  });
  expect(directLogin.status()).toBe(200);
  const auth = (await directLogin.json()).data;
  try {
    const directForbidden = await request.get(
      `${api}/owner/restaurant/verifications`,
      {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      },
    );
    expect(directForbidden.status()).toBe(403);
  } finally {
    await request.post(`${api}/auth/logout`, {
      data: { refreshToken: auth.refreshToken },
    });
  }
  evidence.access = {
    anonymous: 401,
    traveler: 403,
    directBackendAnonymous: 401,
    directBackendTraveler: 403,
  };
});

test("real BE: another owner cannot read the submitted owner's history", async ({
  page,
}) => {
  await login(page, process.env.ANGI_TEST_EMPTY_OWNER_EMAIL!);
  const response = await page.request.get(endpoint);
  expect(response.status()).toBe(404);
  expect((await response.json()).errorCode).toBe("RESTAURANT_NOT_FOUND");
  evidence.ownerIsolation = { status: 404, foreignHistoryDisclosed: false };
});
