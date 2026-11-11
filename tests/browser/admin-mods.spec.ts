import { expect, test, type Page } from "@playwright/test";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";

/** F-65 Manage Mod: ADM-M1..ADM-M4 against a stub shaped like the JSON samples. */
type Mod = {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: null;
  role: "MOD";
  status: string;
  suspendedUntil: null;
  lastLoginAt: string | null;
  createdAt: string;
};
const card = (id: number, displayName: string, status = "active"): Mod => ({
  id,
  email: `mod${id}@angi.vn`,
  displayName,
  avatarUrl: null,
  role: "MOD",
  status,
  suspendedUntil: null,
  lastLoginAt: "2026-10-01T12:30:00Z",
  createdAt: "2026-09-20T03:00:00Z",
});

let mods: Mod[] = [];
let calls: string[] = [];

const handler: StubHandler = ({ method, url, body }, send) => {
  const parsed = new URL(url, "http://stub");
  const path = parsed.pathname;
  if (method === "GET" && path === "/api/v1/admin/permissions") {
    send(200, {
      permissions: [
        { code: "USER_BAN", description: "Cấm vĩnh viễn tài khoản" },
        { code: "MENU_APPROVE", description: "Duyệt thực đơn" },
      ],
      roleDefaults: { MOD: ["USER_BAN", "MENU_APPROVE"], ADMIN: ["*"] },
    });
    return true;
  }
  if (path === "/api/v1/admin/mods") {
    if (method === "GET") {
      calls.push(`ADM-M1 ${parsed.search.slice(1)}`);
      const status = parsed.searchParams.get("status");
      const items = mods.filter((mod) => !status || mod.status === status);
      send(200, {
        items,
        page: 1,
        pageSize: 20,
        totalItems: items.length,
        totalPages: 1,
      });
      return true;
    }
    if (method === "POST") {
      const request = body as { email: string; displayName: string };
      calls.push(`ADM-M2 ${JSON.stringify(body)}`);
      if (mods.some((mod) => mod.email === request.email)) {
        send(409, null, "EMAIL_ALREADY_EXISTS");
        return true;
      }
      const created = {
        ...card(30 + mods.length, request.displayName),
        email: request.email,
        lastLoginAt: null,
      };
      mods = [created, ...mods];
      send(201, created);
      return true;
    }
  }
  const one = /^\/api\/v1\/admin\/mods\/(\d+)$/.exec(path);
  if (one) {
    const mod = mods.find((item) => item.id === Number(one[1]));
    if (!mod) {
      send(404, null, "MOD_NOT_FOUND");
      return true;
    }
    if (method === "PATCH") {
      calls.push(`ADM-M4 ${mod.id} ${JSON.stringify(body)}`);
      Object.assign(mod, body);
      send(200, mod);
      return true;
    }
    calls.push(`ADM-M3 ${mod.id}`);
    send(200, {
      ...mod,
      permissions: {
        roleDefaults: ["USER_BAN", "MENU_APPROVE"],
        overrides: [{ permissionCode: "USER_BAN", effect: "deny" }],
        effective: ["MENU_APPROVE"],
      },
      handled: { verifications: 37, menus: 52, reports: 80 },
    });
    return true;
  }
  return false;
};

let stub: AccountStub;
test.beforeAll(async () => {
  stub = await startAccountStub(5164, handler);
});
test.afterAll(async () => {
  await stopAccountStub(stub);
});
test.beforeEach(() => {
  stub.reset();
  calls = [];
  mods = [card(12, "Mod Linh"), card(13, "Mod Nam", "deactivated")];
});

async function open(page: Page, path = "/administration/moderators") {
  await loginAs(page, "admin");
  await page.goto(path);
}

test("the list shows the active Mods first and filters by status", async ({
  page,
}) => {
  await open(page);
  await expect(
    page.getByRole("heading", { name: "Quản lý Mod", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Mod Linh" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mod Nam" })).toHaveCount(0);
  expect(calls[0]).toBe("ADM-M1 status=active&page=1&pageSize=20");
  await page.getByRole("button", { name: "Đã vô hiệu hóa" }).click();
  await expect(page.getByRole("link", { name: "Mod Nam" })).toBeVisible();
});

test("creating a Mod sends ADM-M2 and shows an e-mail already used under its field", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: /Tạo tài khoản Mod/ }).click();
  const box = page.getByRole("dialog", { name: "Tạo tài khoản Mod" });
  await box.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(box.getByText("Nhập email của Mod.")).toBeVisible();
  expect(calls.some((call) => call.startsWith("ADM-M2"))).toBe(false);

  await box.getByLabel(/^Email/).fill("mod12@angi.vn");
  await box.getByLabel(/^Tên hiển thị/).fill("Mod Mới");
  await box.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(box.getByText("Email này đã có tài khoản ANGI.")).toBeVisible();

  await box.getByLabel(/^Email/).fill("  linh2.mod@angi.vn ");
  await box.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(box).toBeHidden();
  expect(calls).toContain(
    'ADM-M2 {"email":"linh2.mod@angi.vn","displayName":"Mod Mới"}',
  );
  await expect(
    page.getByText("ANGI đã gửi email mời đặt mật khẩu tới linh2.mod@angi.vn."),
  ).toBeVisible();
});

test("the detail shows ADM-M3 and renames and deactivates with ADM-M4", async ({
  page,
}) => {
  await open(page, "/administration/moderators/12");
  await expect(
    page.getByRole("heading", { name: "Mod Linh", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Hồ sơ xác minh đã duyệt")).toBeVisible();
  await expect(page.getByText("37")).toBeVisible();
  await expect(page.getByText("Duyệt thực đơn")).toBeVisible();

  await page.getByLabel(/^Tên hiển thị/).fill("Mod Linh 2");
  await page.getByRole("button", { name: "Lưu tên" }).click();
  await expect
    .poll(() => calls.find((call) => call.startsWith("ADM-M4")))
    .toBe('ADM-M4 12 {"displayName":"Mod Linh 2"}');

  await page.getByRole("button", { name: "Vô hiệu hóa tài khoản" }).click();
  const confirm = page.getByRole("dialog", { name: /Vô hiệu hóa/ });
  await confirm.getByRole("button", { name: "Vô hiệu hóa" }).click();
  await expect(confirm).toBeHidden();
  expect(calls.filter((call) => call.startsWith("ADM-M4")).at(-1)).toBe(
    'ADM-M4 12 {"status":"deactivated"}',
  );
  await expect(
    page.getByRole("button", { name: "Kích hoạt lại" }),
  ).toBeVisible();
});

test("an unknown Mod says so", async ({ page }) => {
  await open(page, "/administration/moderators/999");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy Mod" }),
  ).toBeVisible();
});

test("the list and the detail fit from 320px to 1440px", async ({ page }) => {
  for (const path of [
    "/administration/moderators",
    "/administration/moderators/12",
  ]) {
    await open(page, path);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path} ${width}px`,
      ).toBe(true);
    }
  }
});
