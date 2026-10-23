import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  MenuDetailDto,
  MenuItemDto,
  OwnerMenuDto,
} from "../../src/features/owner/menu-types";

const origin = "http://localhost:3001",
  headers = { Origin: origin },
  base = "/api/backend/owner/restaurant/menu-submissions";
const run = process.env.ANGI_LOCAL_TEST_RUN!; // Validated with exact disposable account names in config.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=",
  "base64",
);
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.ANGI_TEST_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/restaurant$/);
}
async function confirm(page: Page, title: string) {
  const modal = page.getByRole("dialog", { name: title, exact: true });
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(modal).not.toBeVisible();
}

test("real BE: all F50 operations persist, retain the active menu, cancel draft/pending and enforce ownership", async ({
  page,
  context,
  browser,
}) => {
  const evidence: Record<string, unknown> = {
    run,
    checkedAt: new Date().toISOString(),
    completed: false,
    prerequisites:
      "Guarded angi_local fixture marks only a fresh test restaurant verified and inserts two current dishes. This is not Moderator approval evidence.",
  };
  let mapbox = 0;
  const errors: string[] = [],
    native: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  page.on("dialog", async (dialog) => {
    native.push(dialog.type());
    await dialog.dismiss();
  });
  page.on("request", (request) => {
    if (/mapbox/i.test(new URL(request.url()).hostname)) mapbox++;
  });
  await context.route("**/*", (route) =>
    ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
  try {
    await login(page, process.env.ANGI_TEST_OWNER_EMAIL!);
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
    const unverified = await page.request.post(base, { headers });
    expect(unverified.status()).toBe(403);
    expect((await unverified.json()).errorCode).toBe("RESTAURANT_NOT_VERIFIED");
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
    await page.goto("/restaurant/menu");
    await expect(
      page.getByRole("heading", { name: "Mon goc local", exact: true }),
    ).toBeVisible();
    const readMenu = async (): Promise<OwnerMenuDto> => {
      const response = await page.request.get(
        "/api/backend/owner/restaurant/menu",
      );
      expect(response.status()).toBe(200);
      return (await response.json()).data;
    };
    const initial = await readMenu();
    expect(initial.dishes).toHaveLength(2);
    await page
      .getByRole("button", {
        name: "Đánh dấu hết món: Mon goc local",
        exact: true,
      })
      .click();
    await confirm(page, "Cập nhật tình trạng phục vụ?");
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Đánh dấu còn món: Mon goc local",
        exact: true,
      }),
    ).toBeVisible();
    expect((await readMenu()).dishes[0].isAvailable).toBe(false);
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith(base) && response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Tạo bản nháp", exact: true })
      .click();
    const response = await created;
    expect(response.status()).toBe(201);
    const draft: MenuDetailDto = (await response.json()).data;
    expect(draft.items.map((value) => value.change)).toEqual([
      "unchanged",
      "unchanged",
    ]);
    await expect(
      page.getByRole("button", { name: "Thêm món", exact: true }),
    ).toBeVisible();
    const conflict = await page.request.post(base, { headers });
    expect(conflict.status()).toBe(409);
    expect((await conflict.json()).data.id).toBe(draft.id);
    await page
      .getByRole("button", { name: "Sửa Mon giu local", exact: true })
      .click();
    let editor = page.getByRole("dialog", {
      name: "Sửa món trong bản nháp",
      exact: true,
    });
    await editor.getByLabel("Giá (VND) *", { exact: true }).fill("0");
    await editor.getByLabel("Thứ tự hiển thị", { exact: true }).fill("0");
    await editor.getByRole("button", { name: "Lưu món", exact: true }).click();
    await expect(editor).not.toBeVisible();
    await page.getByRole("button", { name: "Thêm món", exact: true }).click();
    editor = page.getByRole("dialog", {
      name: "Thêm món vào bản nháp",
      exact: true,
    });
    await editor
      .getByLabel("Tên món *", { exact: true })
      .fill("Mi Quang F50 local");
    await editor
      .getByLabel("Mô tả món *", { exact: true })
      .fill(
        "Soi mi vang, nuoc leo set, ga ta va dau phong rang cho kiem thu local.",
      );
    await editor.getByLabel("Giá (VND) *", { exact: true }).fill("40000");
    await editor.getByLabel("Loại món", { exact: true }).selectOption("dry");
    const tagResponse = await page.request.get("/api/backend/tags");
    expect(tagResponse.status()).toBe(200);
    const tags: { id: number; name: string }[] = (await tagResponse.json())
      .data;
    if (tags.length)
      await editor.getByLabel(tags[0].name, { exact: true }).check();
    const uploaded = page.waitForResponse(
      (value) =>
        value.url().endsWith("/api/backend/media") &&
        value.request().method() === "POST",
    );
    await editor.getByLabel("Ảnh món ăn", { exact: true }).setInputFiles({
      name: "f50-local.png",
      mimeType: "image/png",
      buffer: png,
    });
    const upload = await uploaded;
    expect(upload.status()).toBe(201);
    const mediaId = (await upload.json()).data.id;
    expect(typeof mediaId).toBe("number");
    await expect(
      editor.getByRole("button", { name: "Bỏ ảnh món ăn" }),
    ).toBeVisible();
    const added = page.waitForResponse(
      (value) =>
        value.url().endsWith(`${base}/${draft.id}/items`) &&
        value.request().method() === "POST",
    );
    await editor.getByRole("button", { name: "Lưu món", exact: true }).click();
    const add = await added;
    expect(add.status()).toBe(201);
    const item: MenuItemDto = (await add.json()).data;
    expect(item.sourceDishId).toBeNull();
    expect(item.change).toBe("new");
    expect(item.coverMediaId).toBe(mediaId);
    await page
      .getByRole("button", { name: "Sửa Mi Quang F50 local", exact: true })
      .click();
    editor = page.getByRole("dialog", {
      name: "Sửa món trong bản nháp",
      exact: true,
    });
    await editor.getByRole("button", { name: "Bỏ ảnh món ăn" }).click();
    await confirm(page, "Bỏ ảnh món ăn?");
    if (tags.length)
      await editor.getByLabel(tags[0].name, { exact: true }).uncheck();
    const updated = page.waitForResponse(
      (value) =>
        value.url().endsWith(`${base}/${draft.id}/items/${item.id}`) &&
        value.request().method() === "PATCH",
    );
    await editor.getByRole("button", { name: "Lưu món", exact: true }).click();
    const patch = await updated;
    expect(patch.status()).toBe(200);
    expect(JSON.parse(patch.request().postData()!)).toEqual({
      coverMediaId: null,
      ...(tags.length ? { tagIds: [] } : {}),
    });
    await expect(editor).not.toBeVisible();
    await page
      .getByRole("button", { name: "Xóa Mon goc local", exact: true })
      .click();
    const deleted = page.waitForResponse(
      (value) => value.request().method() === "DELETE",
    );
    await confirm(page, "Xóa món khỏi bản nháp?");
    const removal = await deleted;
    expect(removal.status()).toBe(200);
    expect((await removal.json()).data).toBeNull();
    await expect(
      page.getByRole("heading", { name: "Món đã bỏ so với thực đơn đang bán" }),
    ).toBeVisible();
    const saved = await page.request.get(`${base}/${draft.id}`);
    expect(saved.status()).toBe(200);
    const detail: MenuDetailDto = (await saved.json()).data;
    expect(
      detail.items.find((value) => value.id === item.id)?.coverMediaId,
    ).toBeNull();
    expect(detail.items.find((value) => value.id === item.id)?.tagIds).toEqual(
      [],
    );
    expect(detail.removedDishes.map((value) => value.id)).toEqual([
      initial.dishes[0].id,
    ]);
    expect(
      (await readMenu()).dishes.map((value) => ({
        id: value.id,
        name: value.name,
        price: value.price,
      })),
    ).toEqual(
      initial.dishes.map((value) => ({
        id: value.id,
        name: value.name,
        price: value.price,
      })),
    );
    const history = await page.request.get(
      `${base}?status=draft&page=1&pageSize=5`,
    );
    expect(history.status()).toBe(200);
    expect(
      (await history.json()).data.items.map(
        (value: { id: number }) => value.id,
      ),
    ).toEqual([draft.id]);
    const other = await browser.newContext({ baseURL: origin });
    try {
      expect((await other.request.get(`${base}/${draft.id}`)).status()).toBe(
        401,
      );
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
      const foreign = await other.request.get(`${base}/${draft.id}`);
      expect(foreign.status()).toBe(404);
      expect((await foreign.json()).errorCode).toBe("SUBMISSION_NOT_FOUND");
      expect(
        (
          await other.request.patch(`${base}/${draft.id}/items/${item.id}`, {
            headers,
            data: { price: 1 },
          })
        ).status(),
      ).toBe(404);
      expect(
        (
          await other.request.put(
            `/api/backend/owner/restaurant/menu/dishes/${initial.dishes[0].id}/availability`,
            { headers, data: { isAvailable: true } },
          )
        ).status(),
      ).toBe(404);
      await other.request.post("/api/auth/logout", { headers });
    } finally {
      await other.close();
    }
    await page
      .getByRole("button", { name: "Hủy bản thực đơn", exact: true })
      .click();
    const cancelled = page.waitForResponse((value) =>
      value.url().endsWith(`${base}/${draft.id}/cancel`),
    );
    await confirm(page, "Hủy bản thực đơn?");
    const cancel = await cancelled;
    expect(cancel.status()).toBe(200);
    expect((await cancel.json()).data.status).toBe("cancelled");
    const stale = await page.request.patch(
      `${base}/${draft.id}/items/${item.id}`,
      { headers, data: { price: 2 } },
    );
    expect(stale.status()).toBe(409);
    expect((await stale.json()).errorCode).toBe("SUBMISSION_NOT_EDITABLE");
    // Prepare a pending record using the existing F51 backend endpoint only, outside the FE feature.
    const nextResponse = await page.request.post(base, { headers });
    expect(nextResponse.status()).toBe(201);
    const next = (await nextResponse.json()).data;
    expect(
      (
        await page.request.patch(
          `${base}/${next.id}/items/${next.items[0].id}`,
          { headers, data: { price: 45001 } },
        )
      ).status(),
    ).toBe(200);
    const backend = process.env.API_BASE_URL!;
    const auth = await page.request.post(`${backend}/auth/login`, {
      data: {
        email: process.env.ANGI_TEST_OWNER_EMAIL,
        password: process.env.ANGI_TEST_PASSWORD,
      },
    });
    expect(auth.status()).toBe(200);
    const credentials = (await auth.json()).data;
    try {
      const pending = await page.request.post(
        `${backend}/owner/restaurant/menu-submissions/${next.id}/submit`,
        {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
          data: { ownerNote: "F50 cancellation test prerequisite" },
        },
      );
      expect(pending.status()).toBe(200);
    } finally {
      await page.request.post(`${backend}/auth/logout`, {
        data: { refreshToken: credentials.refreshToken },
      });
    }
    await page.reload();
    await page
      .getByRole("button", { name: "Mở bản thực đơn", exact: true })
      .click();
    await expect(page.getByText("Chờ duyệt", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Thêm món", exact: true }),
    ).not.toBeVisible();
    await page
      .getByRole("button", { name: "Hủy bản thực đơn", exact: true })
      .click();
    await confirm(page, "Hủy bản thực đơn?");
    await page.reload();
    expect((await readMenu()).openSubmission).toBeNull();
    evidence.endpoints = {
      OWN09: 200,
      OWN10: 200,
      OWN11: 201,
      OWN12: 200,
      OWN13: 200,
      OWN14: 201,
      OWN15: 200,
      OWN16: 200,
      OWN18: 200,
      MEDIA01: 201,
      CAT02: 200,
    };
    evidence.cover = { uploaded: true, cleared: true };
    evidence.tagCatalogCount = tags.length;
    evidence.guards = {
      unverified: 403,
      duplicate: 409,
      anonymous: 401,
      foreignSubmission: 404,
      foreignDish: 404,
      closedDraftPatch: 409,
    };
    evidence.persistence = {
      availability: true,
      draftChanges: true,
      currentMenuUnchanged: true,
      cancelledDraft: true,
      cancelledPending: true,
    };
    expect(errors).toEqual([]);
    expect(native).toEqual([]);
    expect(mapbox).toBe(0);
    evidence.browser = {
      pageErrors: 0,
      nativeDialogs: 0,
      mapboxRequests: mapbox,
    };
    evidence.completed = true;
  } finally {
    await page.request.post("/api/auth/logout", { headers });
    await mkdir("artifacts", { recursive: true });
    await writeFile(
      "artifacts/restaurant-menu-live.json",
      JSON.stringify(evidence, null, 2),
    );
  }
});
