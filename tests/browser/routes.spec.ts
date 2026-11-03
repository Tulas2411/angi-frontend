import { expect, test } from "@playwright/test";
import { HOME_BY_ROLE } from "../../src/features/auth/roles";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
} from "./account-api-stub";

let stub: AccountStub;
test.beforeAll(async () => {
  stub = await startAccountStub();
});
test.afterAll(async () => {
  await stopAccountStub(stub);
});
test.beforeEach(() => stub.reset());

const removedRoutes = [
  "/roadmaps/88/unknown",
  "/blogs",
  "/choose-role",
  "/demo/unknown-role",
  // The component gallery and scenarios exist only in development builds.
  "/dev/components",
  "/dev/scenarios",
];

test("unknown routes and development-only pages answer 404 for guests", async ({
  page,
}) => {
  for (const path of removedRoutes) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Trang này chưa có" }),
    ).toBeVisible();
  }
});

test("protected routes send guests to the login page", async ({ page }) => {
  for (const path of [
    "/account",
    "/restaurant",
    "/roadmaps",
    "/roadmaps/new",
    "/roadmaps/88",
    "/restaurant/register",
    "/restaurant/profile",
    "/restaurant/verification",
    "/restaurant/menu",
    "/restaurant/reviews",
    "/moderation",
    "/administration",
  ]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/login$/);
  }
});

for (const [role, label] of [
  ["traveler", "TRAVELER"],
  ["owner", "RESTAURANT_OWNER"],
  ["mod", "MOD"],
  ["admin", "ADMIN"],
] as const) {
  test(`${role} lands on ${HOME_BY_ROLE[label]} without redirect loops`, async ({
    page,
  }) => {
    await loginAs(page, role);
    await expect(page).toHaveURL(
      new RegExp(`${HOME_BY_ROLE[label].replace("/", "\\/")}$`),
    );
    // A second navigation to "/" must settle on the same landing page.
    await page.goto("/");
    await expect(page).toHaveURL(
      role === "owner" ? /\/restaurant$/ : /localhost:3001\/$/,
    );
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account$/);
    await expect(
      page.getByRole("heading", { name: "Tài khoản của bạn", level: 1 }),
    ).toBeVisible();
  });
}

test("non-owner roles cannot open the owner workspace and return to their landing page", async ({
  page,
}) => {
  for (const [role, label] of [
    ["traveler", "TRAVELER"],
    ["mod", "MOD"],
    ["admin", "ADMIN"],
  ] as const) {
    await loginAs(page, role);
    await page.goto("/restaurant/menu");
    await expect(page).toHaveURL(
      new RegExp(`${HOME_BY_ROLE[label].replace("/", "\\/")}$`),
    );
  }
});

test("the signed-in homepage shows the account menu instead of the login link", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  const header = page.locator("header");
  await expect(
    header.getByRole("link", { name: "Đăng nhập", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Tham gia ANGI/ })).toHaveCount(
    0,
  );
  await expect(
    header.getByRole("link", { name: "Tài khoản Minh Anh", exact: true }),
  ).toHaveAttribute("href", "/account");
  await expect(
    header.getByRole("link", { name: "Trang chủ", exact: true }),
  ).toHaveAttribute("href", "/");
  await expect(
    header.getByRole("button", { name: "Mở menu tài khoản", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
});

test("the account drawer opens with the keyboard, closes with Escape or the backdrop and restores focus", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  const trigger = page.getByRole("button", {
    name: "Mở menu tài khoản",
    exact: true,
  });
  const drawer = page.getByRole("dialog", { name: "Menu tài khoản" });
  const account = drawer.getByRole("link", { name: "Tài khoản của tôi" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(account).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(
    drawer.getByRole("link", { name: "Lộ trình của tôi" }),
  ).toHaveAttribute("href", "/roadmaps");
  await expect(
    drawer.getByRole("link", { name: "Khám phá món ăn" }),
  ).toHaveAttribute("href", "/dishes");
  await expect(
    drawer.getByRole("link", { name: "Khám phá quán ăn" }),
  ).toHaveAttribute("href", "/restaurants");
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  // A click on the dimmed page beside the drawer closes it.
  await trigger.click();
  await expect(drawer).toBeVisible();
  await page.mouse.click(10, 300);
  await expect(drawer).toBeHidden();
  await trigger.click();
  await account.click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(drawer).toBeHidden();
});

test("logout clears the session and protected pages require login again", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  await page
    .getByRole("button", { name: "Mở menu tài khoản", exact: true })
    .click();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await page.context().cookies()).filter(
      (cookie) => cookie.name === "angi_session" && cookie.value !== "",
    ),
  ).toEqual([]);
});

test("the proxy allowlist rejects operations that are not configured", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  const origin = { origin: "http://localhost:3001" };
  for (const [method, path] of [
    ["POST", "admin/users"],
    ["DELETE", "me"],
    ["PUT", "owner/restaurant/unknown"],
  ] as const) {
    const response = await page.request.fetch(`/api/backend/${path}`, {
      method,
      headers: origin,
    });
    expect([403, 404, 405], `${method} ${path}`).toContain(response.status());
  }
  expect(stub.calls.filter((call) => /admin|unknown/.test(call))).toEqual([]);
});
