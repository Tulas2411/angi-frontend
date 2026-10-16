import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  VerificationDto,
  GetVerificationStatusResponseDto,
} from "../../src/features/owner/verification-types";

const origin = "http://localhost:3001";
const endpoint = "/api/backend/owner/restaurant/verifications";
const headers = { Origin: origin };
const run = process.env.ANGI_LOCAL_TEST_RUN!; // The live config validates this exact run/account pair.
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");

function prepareReview(status: "rejected" | "needs_more_info") {
  // This explicit local DB fixture is not evidence of a working Moderator decision API.
  const output = execFileSync(
    "docker",
    [
      "compose",
      "-f",
      "docker-compose.local.yml",
      "run",
      "--rm",
      "-e",
      `ANGI_LOCAL_TEST_RUN=${run}`,
      "seed",
      "dotnet",
      "run",
      "--project",
      "docker/local/Seed",
      "--configuration",
      "Release",
      "--",
      "--set-verification-fixture",
      status,
    ],
    {
      cwd: resolve("../angi-backend"),
      windowsHide: true,
      encoding: "utf8",
      timeout: 70000,
    },
  );
  expect(output.includes("VERIFICATION_FIXTURE ")).toBe(true);
}
async function send(page: Page, previousId: number): Promise<VerificationDto> {
  await page
    .getByRole("button", { name: "Gửi lại hồ sơ xác minh", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Gửi lại hồ sơ xác minh?",
    exact: true,
  });
  await expect(modal).toBeVisible();
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith(`${endpoint}/${previousId}/resubmit`) &&
      response.request().method() === "POST",
  );
  await modal
    .getByRole("button", { name: "Xác nhận gửi lại hồ sơ", exact: true })
    .click();
  const result = await response;
  expect(result.status()).toBe(201);
  await expect(
    page.getByText("Đã gửi lại hồ sơ xác minh. Trạng thái: Chờ duyệt.", {
      exact: true,
    }),
  ).toBeVisible();
  return (await result.json()).data;
}

test("real BE OWN-08: rejected and needs_more_info dossiers create new linked pending attempts, preserving history and ownership", async ({
  page,
  context,
  browser,
}) => {
  const evidence: Record<string, unknown> = {
    run,
    checkedAt: new Date().toISOString(),
    completed: false,
    reviewPreparation: "guarded angi_local fixture, not Moderator API",
  };
  let mapboxRequests = 0;
  const errors: string[] = [];
  const native: string[] = [];
  page.on("request", (request) => {
    if (/mapbox/i.test(new URL(request.url()).hostname)) mapboxRequests++;
  });
  page.on("pageerror", (error) => errors.push(error.name));
  page.on("dialog", async (dialog) => {
    native.push(dialog.type());
    await dialog.dismiss();
  });
  await context.route("**/*", async (route) => {
    const host = new URL(route.request().url()).hostname;
    if (["localhost", "127.0.0.1"].includes(host)) await route.continue();
    else await route.abort();
  });
  try {
    await page.goto("/login");
    await page
      .getByLabel("Email", { exact: true })
      .fill(process.env.ANGI_TEST_OWNER_EMAIL!);
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.ANGI_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/restaurant$/);
    const registered = await page.request.post(
      "/api/backend/owner/restaurant",
      {
        headers,
        data: {
          name: `ANGI resubmit fixture ${run}`,
          phone: "0901234567",
          addressLine: "24 Nguyen Huu Huan",
          provinceName: "Thanh pho Ha Noi",
          latitude: 21.0285,
          longitude: 105.8542,
        },
      },
    );
    expect(registered.status()).toBe(201);
    await page.goto("/restaurant/verification");
    await page
      .getByLabel("Tên pháp lý *", { exact: true })
      .fill("ANGI Resubmit Test");
    await page
      .getByLabel("Số giấy phép kinh doanh *", { exact: true })
      .fill("TEST-ANGI-68");
    const initialUpload = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/backend/media") &&
        response.request().method() === "POST",
    );
    await page
      .getByLabel("Thêm tài liệu xác minh", { exact: true })
      .setInputFiles({
        name: "old-license.pdf",
        mimeType: "application/pdf",
        buffer: pdf,
      });
    const uploaded = await initialUpload;
    const uploadBody = await uploaded.json();
    evidence.initialUpload = {
      status: uploaded.status(),
      errorCode: uploadBody.errorCode,
      message: uploaded.ok() ? null : uploadBody.message,
    };
    expect(uploaded.status()).toBe(201);
    const oldMedia = uploadBody.data;
    const originalRequest = {
      legalName: "ANGI Resubmit Test",
      businessLicenseNo: "TEST-ANGI-68",
      documents: [{ docType: "business_license", mediaId: oldMedia.id }],
    };
    await expect(page.getByText(/PDF · .*Đã tải lên/)).toBeVisible();
    const initialSubmission = page.waitForResponse(
      (response) =>
        response.url().endsWith(endpoint) &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Gửi hồ sơ xác minh", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Xác nhận gửi hồ sơ", exact: true })
      .click();
    const submitted = await initialSubmission;
    expect(submitted.status()).toBe(201);
    const original: VerificationDto = (await submitted.json()).data;
    prepareReview("rejected");
    await page.goto("/restaurant/verification?tab=status");
    await page
      .getByRole("button", { name: "Gửi lại hồ sơ", exact: true })
      .click();
    await expect(page.getByLabel("Tên pháp lý *", { exact: true })).toHaveValue(
      originalRequest.legalName,
    );
    await page
      .getByRole("button", {
        name: `Bỏ tài liệu Tài liệu đã gửi #${oldMedia.id}`,
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Bỏ tài liệu", exact: true })
      .click();
    const uploadResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/backend/media") &&
        response.request().method() === "POST",
    );
    await page
      .getByLabel("Thêm tài liệu xác minh", { exact: true })
      .setInputFiles({
        name: "new-attp.pdf",
        mimeType: "application/pdf",
        buffer: pdf,
      });
    const upload = await uploadResponse;
    expect(upload.status()).toBe(201);
    const newMedia = (await upload.json()).data;
    await expect(page.getByText(/PDF · .*Đã tải lên/)).toBeVisible();
    await page
      .getByLabel("Loại tài liệu · new-attp.pdf", { exact: true })
      .selectOption("food_safety_cert");
    await page
      .getByLabel("Tên pháp lý *", { exact: true })
      .fill("ANGI Resubmit Test updated");
    const second = await send(page, original.id);
    expect(second.previousId).toBe(original.id);
    expect(second.id).not.toBe(original.id);
    expect(
      second.documents.map(({ docType, mediaId }) => ({ docType, mediaId })),
    ).toEqual([{ docType: "food_safety_cert", mediaId: newMedia.id }]);
    expect(second.reviewedBy).toBeNull();
    const replacement = {
      ...originalRequest,
      documents: [{ docType: "food_safety_cert", mediaId: newMedia.id }],
    };
    const duplicate = await page.request.post(
      `${endpoint}/${original.id}/resubmit`,
      { headers, data: replacement },
    );
    expect(duplicate.status()).toBe(409);
    expect((await duplicate.json()).errorCode).toBe(
      "VERIFICATION_NOT_RESUBMITTABLE",
    );
    const missing = await page.request.post(
      `${endpoint}/9223372036854775807/resubmit`,
      { headers, data: replacement },
    );
    expect(missing.status()).toBe(404);
    expect((await missing.json()).errorCode).toBe("VERIFICATION_NOT_FOUND");
    const invalid = await page.request.post(
      `${endpoint}/${second.id}/resubmit`,
      { headers, data: { ...replacement, documents: [] } },
    );
    expect(invalid.status()).toBe(400);
    evidence.rejected = {
      upload: 201,
      resubmit: 201,
      previousId: original.id,
      newId: second.id,
      replacementMediaId: newMedia.id,
      duplicate: 409,
      missing: 404,
      invalid: 400,
    };

    prepareReview("needs_more_info");
    await page.reload();
    await page
      .getByRole("button", { name: "Gửi lại hồ sơ", exact: true })
      .click();
    await expect(page.getByLabel("Tên pháp lý *", { exact: true })).toHaveValue(
      "ANGI Resubmit Test updated",
    );
    const third = await send(page, second.id); // Retains the existing certificate; no new upload.
    expect(third.previousId).toBe(second.id);
    expect(third.documents[0].mediaId).toBe(newMedia.id);
    await page.reload();
    const result = await page.request.get(endpoint);
    expect(result.status()).toBe(200);
    const history: GetVerificationStatusResponseDto = (await result.json())
      .data;
    expect(history.verificationStatus).toBe("pending");
    expect(
      history.items.map(({ id, status, previousId }) => ({
        id,
        status,
        previousId,
      })),
    ).toEqual([
      { id: third.id, status: "pending", previousId: second.id },
      { id: second.id, status: "needs_more_info", previousId: original.id },
      { id: original.id, status: "rejected", previousId: null },
    ]);
    expect(history.items[2].documents[0].mediaId).toBe(oldMedia.id);
    expect(
      history.items[1].reviewedBy !== null &&
        history.items[1].reviewNote !== null,
    ).toBe(true);
    await page
      .getByRole("button", { name: `Xem hồ sơ #${third.id}`, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", {
        name: `Xem hồ sơ trước #${second.id}`,
        exact: true,
      })
      .click();
    await expect(
      page
        .getByRole("dialog")
        .getByText("Du lieu kiem thu: bo sung thong tin ATTP.", {
          exact: true,
        }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Gửi lại hồ sơ", exact: true }),
    ).toHaveCount(0);
    const document = await page.request.get(history.items[0].documents[0].url);
    expect(document.status()).toBe(200);
    expect((await document.body()).subarray(0, 5).toString()).toBe("%PDF-");
    evidence.needsMoreInfo = {
      resubmit: 201,
      previousId: second.id,
      newId: third.id,
      retainedMediaId: newMedia.id,
      history: 200,
      historyCount: 3,
      privateDocument: 200,
      reloadPersisted: true,
    };

    const other = await browser.newContext({ baseURL: origin });
    try {
      expect(
        (
          await other.request.post(`${endpoint}/${original.id}/resubmit`, {
            headers,
            data: replacement,
          })
        ).status(),
      ).toBe(401);
      const login = await other.request.post("/api/auth/login", {
        headers,
        data: {
          email: process.env.ANGI_TEST_EMPTY_OWNER_EMAIL,
          password: process.env.ANGI_TEST_PASSWORD,
        },
      });
      expect(login.status()).toBe(200);
      const created = await other.request.post(
        "/api/backend/owner/restaurant",
        {
          headers,
          data: {
            name: `Foreign owner fixture ${run}`,
            phone: "0901234567",
            addressLine: "24 Nguyen Huu Huan",
            provinceName: "Thanh pho Ha Noi",
            latitude: 21.0285,
            longitude: 105.8542,
          },
        },
      );
      expect(created.status()).toBe(201);
      const foreign = await other.request.post(
        `${endpoint}/${original.id}/resubmit`,
        { headers, data: replacement },
      );
      expect(foreign.status()).toBe(404);
      expect((await foreign.json()).errorCode).toBe("VERIFICATION_NOT_FOUND");
      await other.request.post("/api/auth/logout", { headers });
    } finally {
      await other.close();
    }
    evidence.ownerIsolation = { anonymous: 401, foreignVerification: 404 };
    expect(errors).toEqual([]);
    expect(native).toEqual([]);
    expect(mapboxRequests).toBe(0);
    evidence.browser = { pageErrors: 0, nativeDialogs: 0, mapboxRequests };
    evidence.completed = true;
  } finally {
    await page.request.post("/api/auth/logout", { headers });
    await mkdir("artifacts", { recursive: true });
    await writeFile(
      "artifacts/verification-resubmission-live.json",
      JSON.stringify(evidence, null, 2),
    );
  }
});
