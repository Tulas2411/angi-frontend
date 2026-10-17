import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  MenuDetailDto,
  MenuSubmissionDto,
  OwnerMenuDto,
} from "../../src/features/owner/menu-types";

const origin = "http://localhost:3001",
  headers = { Origin: origin },
  base = "/api/backend/owner/restaurant/menu-submissions";
const run = process.env.ANGI_LOCAL_TEST_RUN!; // Exact fresh owner/run pair validated in the live config.
async function login(page: Page) {
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env.ANGI_TEST_OWNER_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.ANGI_TEST_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/restaurant$/);
}
async function submit(
  page: Page,
  id: number,
  note: string,
): Promise<MenuSubmissionDto> {
  await page
    .getByRole("button", { name: "Gửi duyệt thực đơn", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Gửi thực đơn để duyệt?",
    exact: true,
  });
  await expect(modal).toBeVisible();
  if (note)
    await modal
      .getByLabel("Ghi chú gửi kiểm duyệt", { exact: true })
      .fill(note);
  const response = page.waitForResponse(
    (value) =>
      value.url().endsWith(`${base}/${id}/submit`) &&
      value.request().method() === "POST",
  );
  await modal
    .getByRole("button", { name: "Xác nhận gửi duyệt", exact: true })
    .click();
  const result = await response;
  expect(result.status()).toBe(200);
  expect(JSON.parse(result.request().postData()!)).toEqual(
    note ? { ownerNote: note } : {},
  );
  await expect(
    page.getByText("Đã gửi thực đơn để duyệt. Trạng thái: Chờ duyệt.", {
      exact: true,
    }),
  ).toBeVisible();
  return (await result.json()).data;
}
test("real OWN17: changed draft becomes persisted pending; empty/unchanged/invalid/stale/foreign submissions are rejected", async ({
  page,
  context,
  browser,
}) => {
  const evidence: Record<string, unknown> = {
    run,
    checkedAt: new Date().toISOString(),
    completed: false,
    prerequisites:
      "Existing guarded angi_local MenuFixture creates two source dishes and marks only this fresh test restaurant verified. Not a Moderator decision test.",
  };
  const errors: string[] = [],
    native: string[] = [];
  let mapboxRequests = 0,
    submitPosts = 0;
  page.on("pageerror", (error) => errors.push(error.name));
  page.on("dialog", async (dialog) => {
    native.push(dialog.type());
    await dialog.dismiss();
  });
  page.on("request", (request) => {
    if (/mapbox/i.test(new URL(request.url()).hostname)) mapboxRequests++;
    if (request.method() === "POST" && request.url().endsWith("/submit"))
      submitPosts++;
  });
  await context.route("**/*", (route) =>
    ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
  try {
    await login(page);
    const registered = await page.request.post(
      "/api/backend/owner/restaurant",
      {
        headers,
        data: {
          name: `ANGI menu fixture ${run}`,
          phone: "0901234567",
          addressLine: "24 Nguyen Huu Huan",
          provinceName: "Thanh pho Ha Noi",
          latitude: 21.0285,
          longitude: 105.8542,
        },
      },
    );
    expect(registered.status()).toBe(201);
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
        "--set-menu-fixture",
      ],
      {
        cwd: resolve("../angi-backend"),
        windowsHide: true,
        encoding: "utf8",
        timeout: 90000,
      },
    );
    expect(output.includes("MENU_FIXTURE_READY")).toBe(true);
    async function current(): Promise<OwnerMenuDto> {
      const response = await page.request.get(
        "/api/backend/owner/restaurant/menu",
      );
      expect(response.status()).toBe(200);
      return (await response.json()).data;
    }
    const initial = await current();
    expect(initial.dishes).toHaveLength(2);
    const created = await page.request.post(base, { headers });
    expect(created.status()).toBe(201);
    const draft: MenuDetailDto = (await created.json()).data;
    await page.goto("/restaurant/menu");
    await page
      .getByRole("button", { name: "Mở bản thực đơn", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Gửi duyệt thực đơn", exact: true }),
    ).toBeDisabled();
    const unchanged = await page.request.post(`${base}/${draft.id}/submit`, {
      headers,
      data: {},
    });
    expect(unchanged.status()).toBe(400);
    expect((await unchanged.json()).errorCode).toBe("MENU_UNCHANGED");
    expect(
      (
        await page.request.put(
          `/api/backend/owner/restaurant/menu/dishes/${initial.dishes[0].id}/availability`,
          { headers, data: { isAvailable: false } },
        )
      ).status(),
    ).toBe(200);
    const availabilityOnly = await page.request.post(
      `${base}/${draft.id}/submit`,
      { headers, data: {} },
    );
    expect(availabilityOnly.status()).toBe(400);
    expect((await availabilityOnly.json()).errorCode).toBe("MENU_UNCHANGED");
    expect(
      (
        await page.request.put(
          `/api/backend/owner/restaurant/menu/dishes/${initial.dishes[0].id}/availability`,
          { headers, data: { isAvailable: true } },
        )
      ).status(),
    ).toBe(200);
    const invalid = await page.request.post(`${base}/${draft.id}/submit`, {
      headers,
      data: { ownerNote: "x".repeat(1001) },
    });
    expect(invalid.status()).toBe(400);
    const invalidBody = await invalid.json();
    expect(invalidBody.errorCode).toBe("VALIDATION_FAILED");
    expect(
      Object.keys(invalidBody.errors).some(
        (key) => key.toLowerCase() === "ownernote",
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Sửa Mon goc local", exact: true })
      .click();
    const editor = page.getByRole("dialog", {
      name: "Sửa món trong bản nháp",
      exact: true,
    });
    await editor.getByLabel("Giá (VND) *", { exact: true }).fill("46000");
    await editor.getByRole("button", { name: "Lưu món", exact: true }).click();
    await expect(editor).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Gửi duyệt thực đơn", exact: true }),
    ).toBeEnabled();
    const pending = await submit(page, draft.id, "x".repeat(1000));
    expect(pending).toMatchObject({
      id: draft.id,
      status: "pending",
      ownerNote: "x".repeat(1000),
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
    });
    expect(Number.isFinite(Date.parse(pending.submittedAt!))).toBe(true);
    expect(pending).not.toHaveProperty("items");
    await expect(
      page.getByRole("button", { name: "Thêm món", exact: true }),
    ).not.toBeVisible();
    await page.reload();
    await page
      .getByRole("button", { name: "Mở bản thực đơn", exact: true })
      .click();
    await expect(page.getByText("Chờ duyệt", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Gửi duyệt thực đơn", exact: true }),
    ).not.toBeVisible();
    const persisted = await page.request.get(`${base}/${draft.id}`);
    expect(persisted.status()).toBe(200);
    const saved = (await persisted.json()).data;
    expect(saved).toMatchObject({
      id: draft.id,
      status: "pending",
      ownerNote: "x".repeat(1000),
    });
    // PostgreSQL stores microseconds; the immediate .NET response can contain 100ns precision.
    expect(Date.parse(saved.submittedAt)).toBe(
      Date.parse(pending.submittedAt!),
    );
    expect((await current()).dishes).toEqual(initial.dishes);
    const repeated = await page.request.post(`${base}/${draft.id}/submit`, {
      headers,
      data: {},
    });
    expect(repeated.status()).toBe(409);
    expect((await repeated.json()).errorCode).toBe("SUBMISSION_NOT_EDITABLE");
    expect(
      (
        await page.request.patch(
          `${base}/${draft.id}/items/${draft.items[0].id}`,
          { headers, data: { price: 2 } },
        )
      ).status(),
    ).toBe(409);
    const other = await browser.newContext({ baseURL: origin });
    try {
      expect(
        (
          await other.request.post(`${base}/${draft.id}/submit`, {
            headers,
            data: {},
          })
        ).status(),
      ).toBe(401);
      expect(
        (
          await other.request.post("/api/auth/login", {
            headers,
            data: {
              email: process.env.ANGI_TEST_EMPTY_OWNER_EMAIL,
              password: process.env.ANGI_TEST_PASSWORD,
            },
          })
        ).status(),
      ).toBe(200);
      const foreign = await other.request.post(`${base}/${draft.id}/submit`, {
        headers,
        data: {},
      });
      expect(foreign.status()).toBe(404);
      expect((await foreign.json()).errorCode).toBe("SUBMISSION_NOT_FOUND");
      await other.request.post("/api/auth/logout", { headers });
    } finally {
      await other.close();
    }
    expect(
      (
        await page.request.post(`${base}/${draft.id}/cancel`, { headers })
      ).status(),
    ).toBe(200);
    const nextCreated = await page.request.post(base, { headers });
    expect(nextCreated.status()).toBe(201);
    const next: MenuDetailDto = (await nextCreated.json()).data;
    for (const item of next.items)
      expect(
        (
          await page.request.delete(`${base}/${next.id}/items/${item.id}`, {
            headers,
          })
        ).status(),
      ).toBe(200);
    const empty = await page.request.post(`${base}/${next.id}/submit`, {
      headers,
      data: {},
    });
    expect(empty.status()).toBe(400);
    expect((await empty.json()).errorCode).toBe("MENU_EMPTY");
    expect(
      (
        await page.request.post(`${base}/${next.id}/items`, {
          headers,
          data: {
            name: "Mon moi F51 local",
            description:
              "Mon moi cho kiem thu gui duyet va giu nguyen menu dang ban.",
            dishForm: "other",
            price: 10000,
          },
        })
      ).status(),
    ).toBe(201);
    await page.reload();
    await page
      .getByRole("button", { name: "Mở bản thực đơn", exact: true })
      .click();
    const blank = await submit(page, next.id, "");
    expect(blank).toMatchObject({
      id: next.id,
      status: "pending",
      ownerNote: null,
    });
    const history = await page.request.get(`${base}?page=1&pageSize=5`);
    expect(history.status()).toBe(200);
    const entries = (await history.json()).data.items;
    expect(
      entries.map((entry: { id: number; status: string }) => ({
        id: entry.id,
        status: entry.status,
      })),
    ).toEqual([
      { id: next.id, status: "pending" },
      { id: draft.id, status: "cancelled" },
    ]);
    expect((await current()).dishes).toEqual(initial.dishes);
    expect(submitPosts).toBe(2);
    expect(errors).toEqual([]);
    expect(native).toEqual([]);
    expect(mapboxRequests).toBe(0);
    evidence.own17 = {
      status: 200,
      sameDraftId: true,
      pendingPersistedAfterReload: true,
      note1000: true,
      blankNoteNull: true,
      submittedAt: true,
      activeMenuUnchanged: true,
      history: true,
    };
    evidence.errors = {
      unchanged: 400,
      availabilityOnly: 400,
      empty: 400,
      note1001: 400,
      repeatPending: 409,
      editPending: 409,
      anonymous: 401,
      foreign: 404,
    };
    evidence.browser = {
      submitPosts,
      pageErrors: 0,
      nativeDialogs: 0,
      mapboxRequests,
    };
    evidence.completed = true;
  } finally {
    await page.request.post("/api/auth/logout", { headers });
    await mkdir("artifacts", { recursive: true });
    await writeFile(
      "artifacts/menu-approval-live.json",
      JSON.stringify(evidence, null, 2),
    );
  }
});
