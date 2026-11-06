import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
} from "./account-api-stub";

let stub: AccountStub;
test.beforeAll(async () => {
  stub = await startAccountStub();
  await mkdir("artifacts/footer", { recursive: true });
});
test.afterAll(async () => stopAccountStub(stub));
test.beforeEach(async ({ context }) => {
  stub.reset();
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/locations/provinces")
      return route.fulfill({ json: { success: true, data: [] } });
    return ["localhost", "127.0.0.1"].includes(url.hostname)
      ? route.continue()
      : route.abort();
  });
});

test("guest footer keeps real discovery and auth links, keyboard navigation and back-to-top", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await footer.scrollIntoViewIfNeeded();
  await expect(
    footer.getByRole("link", { name: "Món ăn", exact: true }),
  ).toHaveAttribute("href", "/dishes");
  await expect(
    footer.getByRole("link", { name: "Quán ăn", exact: true }),
  ).toHaveAttribute("href", "/restaurants");
  await expect(
    footer.getByRole("link", { name: "Tham gia ANGI", exact: true }),
  ).toHaveAttribute("href", "/register");
  const top = footer.getByRole("link", { name: "Về đầu trang" });
  await top.focus();
  await expect(top).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  // The invitation block is gone; the journey column still leads a guest to sign in.
  await expect(footer.locator(".site-footer-invitation")).toHaveCount(0);
  await footer
    .getByRole("link", { name: "Lập lộ trình mới", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login/);
});

for (const role of ["traveler", "owner", "mod", "admin"] as const) {
  test(`shared account footer gives ${role} its own workspace actions`, async ({
    page,
  }) => {
    await loginAs(page, role);
    await page.goto("/account");
    const footer = page.getByRole("contentinfo");
    await footer.scrollIntoViewIfNeeded();
    await expect(
      footer.getByRole("link", { name: "Tài khoản của tôi", exact: true }),
    ).toHaveAttribute("href", "/account");
    await expect(
      footer.getByRole("link", { name: "Tham gia ANGI", exact: true }),
    ).toHaveCount(0);
    if (role === "traveler") {
      await expect(
        footer.getByRole("link", { name: "Lộ trình của tôi", exact: true }),
      ).toHaveAttribute("href", "/roadmaps");
      await expect(
        footer.getByRole("link", { name: "Lập lộ trình mới", exact: true }),
      ).toHaveAttribute("href", "/roadmaps?new=1");
    } else {
      await expect(
        footer.getByRole("link", { name: "Lộ trình của tôi", exact: true }),
      ).toHaveCount(0);
      const href =
        role === "owner"
          ? "/restaurant"
          : role === "mod"
            ? "/moderation"
            : "/administration";
      // The role's workspace is linked from the footer's second column.
      await expect(footer.locator(`a[href="${href}"]`).first()).toBeVisible();
    }
    if (role === "owner") {
      await expect(
        footer.getByRole("link", { name: "Thực đơn", exact: true }),
      ).toHaveAttribute("href", "/restaurant/menu");
      await page.setViewportSize({ width: 390, height: 900 });
      await footer.screenshot({ path: "artifacts/footer/owner-390.png" });
    }
  });
}

for (const width of [1440, 1024, 768, 390, 320]) {
  test(`footer fits ${width}px with no horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await footer.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    expect(
      await footer.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    await footer.screenshot({ path: `artifacts/footer/guest-${width}.png` });
  });
}
