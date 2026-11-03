import { expect, test, type Page } from "@playwright/test";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";

/** F-66 Manage Permission: ADM-P1..ADM-P4 and ADM-M1 against a stub shaped like the JSON samples. */
const catalog = {
  permissions: [
    { code: "USER_SUSPEND", description: "Tạm đình chỉ tài khoản" },
    { code: "USER_BAN", description: "Cấm vĩnh viễn tài khoản" },
    { code: "MENU_APPROVE", description: "Duyệt thực đơn" },
    { code: "BLOG_MODERATE", description: "Kiểm duyệt bài viết" },
    { code: "MOD_MANAGE", description: "Quản lý Mod" },
    { code: "SYSTEM_AUDIT_VIEW", description: "Xem nhật ký hệ thống" },
  ],
  roleDefaults: {
    MOD: ["USER_SUSPEND", "USER_BAN", "MENU_APPROVE"],
    ADMIN: ["*"],
  },
};
const mods = [
  {
    id: 21,
    email: "mod.an@angi.vn",
    displayName: "Mod An",
    avatarUrl: null,
    role: "MOD",
    status: "active",
    suspendedUntil: null,
    lastLoginAt: null,
    createdAt: "2026-10-01T02:00:00Z",
  },
  {
    id: 22,
    email: "mod.binh@angi.vn",
    displayName: "Mod Bình",
    avatarUrl: null,
    role: "MOD",
    status: "active",
    suspendedUntil: null,
    lastLoginAt: null,
    createdAt: "2026-10-02T02:00:00Z",
  },
];

let calls: string[] = [];
let roleDefaults: string[] = [];
let overrides: Record<number, { permissionCode: string; effect: string }[]> =
  {};
let failRolePut: string | null = null;

const effective = (userId: number) => {
  const result = new Set(roleDefaults);
  for (const item of overrides[userId] ?? [])
    if (item.effect === "allow") result.add(item.permissionCode);
    else result.delete(item.permissionCode);
  return [...result];
};

const handler: StubHandler = ({ method, url, body }, send) => {
  const parsed = new URL(url, "http://stub");
  const path = parsed.pathname;
  if (method === "GET" && path === "/api/v1/admin/permissions") {
    calls.push("ADM-P1");
    send(200, {
      ...catalog,
      roleDefaults: { MOD: roleDefaults, ADMIN: ["*"] },
    });
    return true;
  }
  if (method === "PUT" && path === "/api/v1/admin/roles/MOD/permissions") {
    calls.push(`ADM-P4 ${JSON.stringify(body)}`);
    if (failRolePut) {
      send(400, null, failRolePut);
      return true;
    }
    roleDefaults = (body as { permissionCodes: string[] }).permissionCodes;
    send(200, { role: "MOD", permissionCodes: roleDefaults });
    return true;
  }
  if (method === "GET" && path === "/api/v1/admin/mods") {
    calls.push(`ADM-M1 ${parsed.search.slice(1)}`);
    const q = (parsed.searchParams.get("q") ?? "").toLowerCase();
    const items = mods.filter(
      (mod) => !q || mod.displayName.toLowerCase().includes(q),
    );
    send(200, {
      items,
      page: 1,
      pageSize: 20,
      totalItems: items.length,
      totalPages: 1,
    });
    return true;
  }
  const one = /^\/api\/v1\/admin\/mods\/(\d+)\/permissions$/.exec(path);
  if (one) {
    const userId = Number(one[1]);
    if (!mods.some((mod) => mod.id === userId)) {
      send(404, null, "MOD_NOT_FOUND");
      return true;
    }
    if (method === "PUT") {
      calls.push(`ADM-P3 ${userId} ${JSON.stringify(body)}`);
      overrides[userId] = (
        body as { overrides: { permissionCode: string; effect: string }[] }
      ).overrides;
    } else calls.push(`ADM-P2 ${userId}`);
    send(200, {
      roleDefaults,
      overrides: overrides[userId] ?? [],
      effective: effective(userId),
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
  roleDefaults = [...catalog.roleDefaults.MOD];
  overrides = { 21: [{ permissionCode: "USER_BAN", effect: "deny" }] };
  failRolePut = null;
});

async function open(page: Page, path = "/administration/permissions") {
  await loginAs(page, "admin");
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Phân quyền", level: 1 }),
  ).toBeVisible();
}

test("the MOD defaults are switches; the Admin-only ones are locked", async ({
  page,
}) => {
  await open(page);
  await expect(
    page.getByRole("switch", { name: "Duyệt thực đơn" }),
  ).toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Kiểm duyệt bài viết" }),
  ).not.toBeChecked();
  await expect(page.getByRole("switch", { name: "Quản lý Mod" })).toHaveCount(
    0,
  );
  await expect(page.getByText("Chỉ quản trị viên")).toHaveCount(2);
  expect(calls).toEqual(["ADM-P1"]);
});

test("saving the MOD defaults asks first and sends ADM-P4 in catalog order", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("switch", { name: "Kiểm duyệt bài viết" }).check();
  await page.getByRole("switch", { name: "Cấm vĩnh viễn tài khoản" }).uncheck();
  await expect(page.getByText("2 thay đổi chưa lưu")).toBeVisible();
  await page.getByRole("button", { name: "Lưu quyền mặc định" }).click();
  const confirm = page.getByRole("dialog", {
    name: "Đổi quyền mặc định của Mod?",
  });
  await expect(confirm).toContainText("Bật thêm: Kiểm duyệt bài viết");
  await expect(confirm).toContainText("Tắt: Cấm vĩnh viễn tài khoản");
  await confirm.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(confirm).toBeHidden();
  expect(calls.at(-1)).toBe(
    'ADM-P4 {"permissionCodes":["USER_SUSPEND","MENU_APPROVE","BLOG_MODERATE"]}',
  );
  await expect(page.getByText("Đã lưu quyền mặc định.")).toBeVisible();
});

test("a refused ADM-P4 keeps the dialog and says why", async ({ page }) => {
  await open(page);
  failRolePut = "PERMISSION_NOT_GRANTABLE";
  await page.getByRole("switch", { name: "Kiểm duyệt bài viết" }).check();
  await page.getByRole("button", { name: "Lưu quyền mặc định" }).click();
  const confirm = page.getByRole("dialog", {
    name: "Đổi quyền mặc định của Mod?",
  });
  await confirm.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(confirm).toContainText("chỉ dành cho quản trị viên");
});

test("one Mod: defaults, overrides and effective permissions, saved with ADM-P3", async ({
  page,
}) => {
  await open(page, "/administration/permissions?tab=mods");
  await page.getByRole("button", { name: /Mod An/ }).click();
  await expect(page).toHaveURL(/mod=21/);
  // ADM-P2 sample: USER_BAN is denied, so the Mod does not have it.
  const ban = page.getByRole("radiogroup", {
    name: "Cấm vĩnh viễn tài khoản: ghi đè cho Mod An",
  });
  await expect(ban.getByRole("radio", { name: "Chặn" })).toBeChecked();
  await page
    .getByRole("radiogroup", { name: "Kiểm duyệt bài viết: ghi đè cho Mod An" })
    .getByRole("radio", { name: "Cho phép" })
    .check();
  await ban.getByRole("radio", { name: "Theo mặc định" }).check();
  await page.getByRole("button", { name: "Lưu quyền của Mod An" }).click();
  await expect
    .poll(() => calls.at(-1))
    .toBe(
      'ADM-P3 21 {"overrides":[{"permissionCode":"BLOG_MODERATE","effect":"allow"}]}',
    );
  await expect(page.getByText("Đã lưu quyền của Mod An.")).toBeVisible();
});

test("switching Mod with unsaved changes asks before dropping them", async ({
  page,
}) => {
  await open(page, "/administration/permissions?tab=mods&mod=21");
  await page
    .getByRole("radiogroup", { name: "Duyệt thực đơn: ghi đè cho Mod An" })
    .getByRole("radio", { name: "Chặn" })
    .check();
  await page.getByRole("button", { name: /Mod Bình/ }).click();
  const confirm = page.getByRole("dialog", { name: "Bỏ thay đổi chưa lưu?" });
  await confirm.getByRole("button", { name: "Tiếp tục chỉnh" }).click();
  await expect(page).toHaveURL(/mod=21/);
  await page.getByRole("button", { name: /Mod Bình/ }).click();
  await confirm.getByRole("button", { name: "Bỏ thay đổi" }).click();
  await expect(page).toHaveURL(/mod=22/);
  expect(calls.some((call) => call.startsWith("ADM-P3"))).toBe(false);
});

test("the page fits from 320px to 1440px", async ({ page }) => {
  await open(page, "/administration/permissions?tab=mods&mod=21");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${width}px`,
    ).toBe(true);
  }
});
