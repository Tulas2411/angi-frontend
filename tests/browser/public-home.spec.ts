import { createServer, type Server } from "node:http";
import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { HOME_BY_ROLE } from "../../src/features/auth/roles";
import type { RoleCode } from "../../src/features/auth/types";

let server: Server;
let backendCalls = 0;
test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    backendCalls++;
    if (req.url !== "/api/v1/auth/login" || req.method !== "POST") {
      res.writeHead(500).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const { email } = JSON.parse(Buffer.concat(chunks).toString()) as {
      email: string;
    };
    const role = email.split("@")[0] as RoleCode;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        errorCode: null,
        message: null,
        data: {
          accessToken: "home-local-access",
          refreshToken: "home-local-refresh",
          accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(),
          refreshTokenExpiresAt: new Date(
            Date.now() + 2592000000,
          ).toISOString(),
          user: {
            id: 22,
            email,
            displayName: "Homepage test",
            avatarUrl: null,
            status: "active",
            needsPreferenceSurvey: null,
            role,
          },
        },
      }),
    );
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
  backendCalls = 0;
  await context.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    return ["localhost", "127.0.0.1"].includes(host)
      ? route.continue()
      : route.abort();
  });
});

test("guest can explore, search without accents, filter, reload and go back without logging in", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Ăn đúng gu.",
  );
  await expect(page.locator("article")).toHaveCount(8);
  await page.getByLabel("Bữa tiếp theo, bạn đang thèm gì?").fill("bun cha");
  await page.getByRole("button", { name: "Tìm món" }).click();
  await expect(page).toHaveURL(/\?q=bun\+cha#mon-ngon$/);
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.locator("article h3")).toHaveText("Bún chả");
  await page.reload();
  await expect(page.getByRole("searchbox")).toHaveValue("bun cha");
  await page.getByRole("link", { name: "Thanh nhẹ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Chưa tìm thấy món bạn đang thèm." }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.locator("article h3")).toHaveText("Bún chả");
  await page.getByRole("link", { name: /Bỏ bộ lọc/ }).click();
  await expect(page).toHaveURL("/#mon-ngon");
  await expect(page.locator("article")).toHaveCount(8);
  await page.getByRole("link", { name: "Thanh nhẹ", exact: true }).click();
  await expect(page).toHaveURL(/\?taste=fresh#mon-ngon$/);
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.locator("article h3")).toHaveText("Gỏi cuốn tôm");
  expect(backendCalls).toBe(0);
  expect(errors).toEqual([]);
  expect(
    (await page.context().cookies()).filter(
      (cookie) => cookie.name === "angi_session",
    ),
  ).toEqual([]);
});

test("editorial search and filters still work without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: "http://localhost:3001",
  });
  try {
    await context.route("**/*", (route) =>
      ["localhost", "127.0.0.1"].includes(
        new URL(route.request().url()).hostname,
      )
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("searchbox").fill("pho");
    await page.getByRole("button", { name: "Tìm món" }).click();
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.locator("article h3")).toHaveText("Phở bò");
    await page.getByRole("link", { name: /Bỏ bộ lọc/ }).click();
    await expect(page).toHaveURL("/#mon-ngon");
    await page.getByRole("link", { name: "Đậm đà", exact: true }).click();
    await expect(page.locator("article")).toHaveCount(4);
    expect(backendCalls).toBe(0);
  } finally {
    await context.close();
  }
});

test("keyboard skip link and dish modal keep background inert, close with Escape and restore focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Đến nội dung chính" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  const trigger = page.getByRole("button", {
    name: "Khám phá Phở bò",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Phở bò", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Thưởng thức theo cách của bạn")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Đóng hộp thoại" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  // Chromium also makes the dialog's scrolling content keyboard-focusable.
  await expect(dialog.locator(".dialog-content")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Tiếp tục khám phá" }),
  ).toBeFocused();
  const backgroundLink = page
    .locator("header")
    .getByRole("link", { name: "Đăng nhập", exact: true });
  await backgroundLink.evaluate((element: HTMLAnchorElement) =>
    element.focus(),
  );
  await expect(backgroundLink).not.toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("button", { name: "Tiếp tục khám phá" }).click();
  await expect(trigger).toBeFocused();
  expect(backendCalls).toBe(0);
});

test("auth links work and protected owner routes still require a real session", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("header")
    .getByRole("link", { name: "Đăng nhập", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page
      .locator("h1")
      .evaluate((element) => getComputedStyle(element).fontFamily),
  ).toContain("Fraunces");
  await page.goto("/");
  await page
    .locator("header")
    .getByRole("link", { name: /Tham gia ANGI/ })
    .click();
  await expect(page).toHaveURL(/\/register$/);
  await page.goto("/restaurant/menu");
  await expect(page).toHaveURL(/\/login/);
  expect(backendCalls).toBe(0);
});

test("guest can try taste examples and see the reason without creating a profile", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Khám phá gu ăn", exact: true }).click();
  await expect(page).toHaveURL(/#goi-y$/);
  const preview = page.locator("#goi-y");
  await expect(
    preview.getByRole("button", { name: "Đậm đà", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(preview.getByRole("heading", { level: 3 })).toHaveText(
    "Bún chả",
  );
  const fresh = preview.getByRole("button", { name: "Thanh nhẹ", exact: true });
  await fresh.click();
  await expect(fresh).toHaveAttribute("aria-pressed", "true");
  await expect(preview.getByRole("heading", { level: 3 })).toHaveText(
    "Gỏi cuốn tôm",
  );
  await expect(preview.getByText(/Rau xanh giòn mát, tôm/)).toBeVisible();
  const warm = preview.getByRole("button", { name: "Ấm bụng", exact: true });
  await warm.focus();
  await page.keyboard.press("Space");
  await expect(preview.getByRole("heading", { level: 3 })).toHaveText("Phở bò");
  await expect(
    preview.getByText(/Lựa chọn này không được lưu vào hồ sơ/),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(8);
  await expect(
    preview.getByRole("link", { name: /Tham gia ANGI/ }),
  ).toHaveAttribute("href", "/register");
  expect(backendCalls).toBe(0);
  await page.reload();
  await expect(preview.getByRole("heading", { level: 3 })).toHaveText(
    "Bún chả",
  );
});

test("roadmap sample switches days and meal details without saving or loading a map", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Xem roadmap mẫu", exact: true })
    .click();
  await expect(page).toHaveURL(/#lich-trinh$/);
  const preview = page.locator("#lich-trinh");
  await expect(preview.locator("figure strong")).toHaveText("Phở bò");
  await preview
    .getByRole("button", { name: /12:00.*Bữa trưa.*Bún chả/ })
    .click();
  await expect(preview.locator("figure strong")).toHaveText("Bún chả");
  await preview.getByRole("button", { name: "Ngày 2", exact: true }).click();
  await expect(preview.locator("figure strong")).toHaveText("Bánh cuốn");
  await expect(
    preview.getByRole("list", { name: "Ngày 2 · Các bữa ăn mẫu" }),
  ).toBeVisible();
  await preview
    .getByRole("button", { name: /12:30.*Bữa trưa.*Bánh mì trứng/ })
    .click();
  await expect(preview.locator("figure strong")).toHaveText("Bánh mì trứng");
  await expect(preview.locator("figure img")).toHaveAttribute(
    "alt",
    "Bánh mì trứng với rau thơm và đồ chua",
  );
  const firstDay = preview.getByRole("button", { name: "Ngày 1", exact: true });
  await firstDay.focus();
  await page.keyboard.press("Enter");
  await expect(firstDay).toHaveAttribute("aria-pressed", "true");
  await expect(preview.locator("figure strong")).toHaveText("Phở bò");
  await expect(
    preview.getByText(/Lịch trình minh họa, không được lưu/),
  ).toBeVisible();
  await expect(
    preview.getByRole("link", { name: /Tham gia ANGI/ }),
  ).toHaveAttribute("href", "/register");
  expect(backendCalls).toBe(0);
});

for (const role of Object.keys(HOME_BY_ROLE) as RoleCode[]) {
  test(`authenticated ${role} lands on its role destination`, async ({
    request,
  }) => {
    const login = await request.post("/api/auth/login", {
      headers: { Origin: "http://localhost:3001" },
      data: { email: `${role}@angi.example`, password: "Localtest123!" },
    });
    expect(login.status()).toBe(200);
    const home = await request.get("/", { maxRedirects: 0 });
    const body = await home.text();
    if (role === "RESTAURANT_OWNER") {
      expect(home.headers().location ?? body).toContain(HOME_BY_ROLE[role]);
      expect(body).not.toContain('id="home-title"');
    } else {
      // Roles without a backend-integrated workspace see the homepage in its signed-in state.
      expect(home.status()).toBe(200);
      expect(body).toContain('id="home-title"');
      expect(body).toContain("Homepage test");
      expect(body).not.toContain("Tham gia ANGI");
    }
    expect(body).not.toContain("home-local-access");
    expect(backendCalls).toBe(1);
  });
}

async function readyForScreenshot(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  for (const image of await page.locator("main img:visible").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty("complete", true);
    expect(
      await image.evaluate((element: HTMLImageElement) => element.naturalWidth),
    ).toBeGreaterThan(0);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Find a usable exposed patch of an overlapped photo, rather than forcing a click. */
async function exposedPhotoPoint(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true }).evaluate((button) => {
    const box = button.getBoundingClientRect();
    const ownsPoint = (x: number, y: number) =>
      document.elementFromPoint(x, y)?.closest("button") === button;
    for (
      let y = Math.max(24, box.top + 24);
      y < Math.min(innerHeight - 24, box.bottom - 24);
      y += 16
    ) {
      for (
        let x = Math.max(24, box.left + 24);
        x < Math.min(innerWidth - 24, box.right - 24);
        x += 16
      ) {
        if (
          ownsPoint(x, y) &&
          ownsPoint(x - 16, y - 16) &&
          ownsPoint(x + 16, y + 16)
        )
          return { x, y };
      }
    }
    return null;
  });
}

test("photo cloud overlaps, reveals its hovered photo and dims the others", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/#mon-ngon");
  const cloud = page.locator(".home-dish-cloud");
  await cloud.scrollIntoViewIfNeeded();
  const rects = await cloud.locator("article").evaluateAll((items) =>
    items.map((item) => {
      const rect = item.getBoundingClientRect();
      return {
        width: rect.width,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    }),
  );
  const widths = rects.map((rect) => rect.width);
  expect(Math.max(...widths) / Math.min(...widths)).toBeGreaterThan(1.15);
  expect(
    rects.some((a, index) =>
      rects
        .slice(index + 1)
        .some(
          (b) =>
            Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
            Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top),
        ),
    ),
  ).toBe(true);
  const brightest = await cloud.locator("article").evaluateAll((items) =>
    items
      .reduce((best, item) =>
        Number(getComputedStyle(item).zIndex) >
        Number(getComputedStyle(best).zIndex)
          ? item
          : best,
      )
      .querySelector("button")
      ?.getAttribute("aria-label"),
  );
  expect(brightest).toBeTruthy();
  const point = await exposedPhotoPoint(page, brightest!);
  expect(point).not.toBeNull();
  await page.mouse.move(point!.x, point!.y);
  await expect(cloud.locator('article[data-active="true"]')).toHaveCount(1);
  await expect(cloud.locator('article[data-active="true"]')).toHaveCSS(
    "z-index",
    "20",
  );
  await expect(cloud.locator('article[data-active="false"]').first()).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(cloud.locator('article[data-active="false"]').first()).toHaveCSS(
    "filter",
    "brightness(0.28) blur(12px)",
  );
  await expect(cloud.locator('article[data-active="true"] img')).toHaveCSS(
    "filter",
    "brightness(1.06) saturate(1.06)",
  );
  await page.screenshot({
    path: "artifacts/homepage/cloud-hover.png",
    animations: "disabled",
  });
  await page.mouse.move(0, 0);
  await expect(cloud).toHaveAttribute("data-engaged", "false");
  const keyboardPhoto = page.getByRole("button", {
    name: "Khám phá Phở bò",
    exact: true,
  });
  await keyboardPhoto.focus();
  await expect(cloud.locator('article[data-active="true"]')).toContainText(
    "Phở bò",
  );
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Phở bò", exact: true }),
  ).toBeVisible();
});

test("popup transitions enter and exit while retaining content, then can reopen", async ({
  page,
}) => {
  await page.goto("/#mon-ngon");
  const photo = page.getByRole("button", {
    name: "Khám phá Phở bò",
    exact: true,
  });
  await photo.focus();
  async function transition(opening: boolean) {
    return page.evaluate(
      (isOpening) =>
        new Promise<{ seen: boolean; open: boolean; text: string }>(
          (resolve) => {
            const dialog =
              document.querySelector<HTMLDialogElement>(".home-food-dialog")!;
            const finish = (seen: boolean) => {
              dialog.removeEventListener("transitionrun", onRun);
              clearTimeout(timer);
              resolve({
                seen,
                open: dialog.open,
                text: dialog.textContent ?? "",
              });
            };
            const onRun = (event: Event) => {
              if (
                event.target === dialog &&
                (event as TransitionEvent).propertyName === "opacity"
              )
                finish(true);
            };
            const timer = setTimeout(() => finish(false), 1500);
            dialog.addEventListener("transitionrun", onRun);
            const trigger = isOpening
              ? document.querySelector<HTMLButtonElement>(
                  '.home-dish-photo[aria-label="Khám phá Phở bò"]',
                )
              : dialog.querySelector<HTMLButtonElement>(
                  'button[aria-label="Đóng hộp thoại"]',
                );
            trigger?.click();
          },
        ),
      opening,
    );
  }
  const entering = await transition(true);
  expect(entering.seen).toBe(true);
  expect(entering.open).toBe(true);
  const dialog = page.getByRole("dialog", { name: "Phở bò", exact: true });
  await dialog.evaluate((element) =>
    Promise.all(
      element
        .getAnimations()
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
  const leaving = await transition(false);
  expect(leaving.seen).toBe(true);
  expect(leaving.open).toBe(false);
  expect(leaving.text).toContain("Hương quế hồi");
  await expect(dialog).not.toBeVisible();
  await expect(photo).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test.describe("popup image loading on a high-density screen", () => {
  test.use({ deviceScaleFactor: 2 });
  test("popup keeps the loaded thumbnail visible while its larger photo is delayed", async ({
    page,
  }) => {
    let releaseImage = () => {};
    const imageGate = new Promise<void>((resolve) => {
      releaseImage = resolve;
    });
    const isLargePhoto = (url: string) => {
      const parsed = new URL(url);
      return (
        parsed.pathname === "/_next/image" &&
        parsed.searchParams.get("url") === "/assets/figma/dish-0.png" &&
        Number(parsed.searchParams.get("w")) >= 1080
      );
    };
    await page.route("**/_next/image?**", async (route) => {
      if (isLargePhoto(route.request().url())) await imageGate;
      await route.continue();
    });
    try {
      await page.goto("/#mon-ngon");
      const photo = page.getByRole("button", {
        name: "Khám phá Phở bò",
        exact: true,
      });
      await photo.focus();
      const thumbnail = photo.locator("img");
      await expect
        .poll(() =>
          thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth),
        )
        .toBeGreaterThan(0);
      const loadedSource = await thumbnail.evaluate(
        (img: HTMLImageElement) => img.currentSrc,
      );
      const pendingPhoto = page.waitForRequest((request) =>
        isLargePhoto(request.url()),
      );
      await page.keyboard.press("Enter");
      await pendingPhoto;
      const dialog = page.getByRole("dialog", { name: "Phở bò", exact: true });
      await expect(dialog).toBeVisible();
      const image = dialog.locator(".home-detail-image");
      expect(
        await image.evaluate(
          (element) => getComputedStyle(element).backgroundImage,
        ),
      ).toContain(loadedSource);
      expect(
        await image
          .locator("img")
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      ).toBe(0);
      await dialog.evaluate((element) =>
        Promise.all(
          element
            .getAnimations({ subtree: true })
            .map((animation) => animation.finished.catch(() => {})),
        ),
      );
      const before = await image.boundingBox();
      await mkdir("artifacts/homepage", { recursive: true });
      await page.screenshot({
        path: "artifacts/homepage/dish-loading-preview.png",
        animations: "disabled",
      });
      releaseImage();
      await expect
        .poll(() =>
          image
            .locator("img")
            .evaluate((img: HTMLImageElement) => img.naturalWidth),
        )
        .toBeGreaterThan(0);
      const after = await image.boundingBox();
      expect(after?.height).toBeCloseTo(before?.height ?? 0, 1);
      await dialog.getByRole("button", { name: "Đóng hộp thoại" }).click();
      await expect(dialog).not.toBeVisible();
      await expect(photo).toBeFocused();
      expect(backendCalls).toBe(0);
    } finally {
      releaseImage();
    }
  });
});

test("five and six filtered photos retain exposed hit areas on desktop and mobile", async ({
  page,
}) => {
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 960 });
    for (const [query, count] of [
      ["miền", 5],
      ["đ", 6],
    ] as const) {
      await page.goto(`/?q=${encodeURIComponent(query)}#mon-ngon`);
      const cloud = page.locator(".home-dish-cloud");
      await cloud.scrollIntoViewIfNeeded();
      const photos = cloud.getByRole("button");
      await expect(photos).toHaveCount(count);
      for (const name of await photos.evaluateAll((items) =>
        items.map((item) => item.getAttribute("aria-label")!),
      )) {
        expect(
          await exposedPhotoPoint(page, name),
          `${name} at ${width}px (${count} results)`,
        ).not.toBeNull();
      }
    }
  }
  expect(backendCalls).toBe(0);
});

test("all eight scattered photos remain tappable at 320px with reduced motion", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: "http://localhost:3001",
    viewport: { width: 320, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  try {
    await context.route("**/*", (route) =>
      ["localhost", "127.0.0.1"].includes(
        new URL(route.request().url()).hostname,
      )
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    await page.goto("/#mon-ngon");
    const cloud = page.locator(".home-dish-cloud");
    const names = await cloud
      .getByRole("button")
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute("aria-label")!),
      );
    for (const name of names) {
      await page.locator("#collection-title").focus();
      await cloud.scrollIntoViewIfNeeded();
      const point = await exposedPhotoPoint(page, name);
      expect(point, `Exposed tap area for ${name}`).not.toBeNull();
      await page.touchscreen.tap(point!.x, point!.y);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(
        name.replace("Khám phá ", ""),
      );
      await expect(dialog).toHaveCSS("transition-duration", "0s");
      await expect(dialog.locator(".dialog-heading")).toHaveCSS(
        "transition-duration",
        "0s",
      );
      await expect(cloud.locator("article").first()).toHaveCSS(
        "transition-duration",
        "0s",
      );
      await dialog.getByRole("button", { name: "Đóng hộp thoại" }).tap();
      await expect(dialog).not.toBeVisible();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    expect(backendCalls).toBe(0);
  } finally {
    await context.close();
  }
});

for (const width of [1440, 768, 390, 320]) {
  test(`homepage and modal fit ${width}px with local photos and shared fonts`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    let mapboxRequests = 0;
    page.on("request", (request) => {
      if (/mapbox\.(com|cn)/.test(request.url())) mapboxRequests++;
    });
    await page.goto("/");
    await readyForScreenshot(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const fonts = await page.locator("h1").evaluate((element) => ({
      family: getComputedStyle(element).fontFamily,
      background: getComputedStyle(document.body).backgroundColor,
    }));
    expect(fonts.family).toContain("Fraunces");
    expect(fonts.background).toBe("rgb(244, 239, 231)");
    await mkdir("artifacts/homepage", { recursive: true });
    await page.screenshot({
      path: `artifacts/homepage/home-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    for (const section of ["goi-y", "lich-trinh", "mon-ngon"]) {
      await page.locator(`#${section}`).screenshot({
        path: `artifacts/homepage/${section}-${width}.png`,
        animations: "disabled",
      });
    }
    const photo = page.getByRole("button", {
      name: "Khám phá Phở bò",
      exact: true,
    });
    await photo.focus();
    await photo.click();
    const dialog = page.getByRole("dialog", { name: "Phở bò", exact: true });
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await expect(
      dialog.getByRole("button", { name: "Đóng hộp thoại" }),
    ).toBeInViewport();
    await page.screenshot({
      path: `artifacts/homepage/dish-${width}.png`,
      animations: "disabled",
    });
    expect(mapboxRequests).toBe(0);
    expect(backendCalls).toBe(0);
  });
}
