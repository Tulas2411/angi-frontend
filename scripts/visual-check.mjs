import { chromium } from "@playwright/test";
import fs from "node:fs";
const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const allRoutes = [
  ["home", "/demo/guest", "92:454"],
  ["logged-home", "/demo/traveler", "92:2379"],
  ["restaurants", "/demo/guest/restaurants", "discovered-public"],
  [
    "restaurant-detail",
    "/demo/traveler/restaurants/bep-nha",
    "discovered-public",
  ],
  ["dishes", "/demo/guest/dishes", "discovered-public"],
  ["guides", "/demo/guest/guides", "447:28878"],
  ["guide-detail", "/demo/traveler/guides/guide-2", "103:3810"],
  ["login", "/login", "465:49315"],
  ["register", "/demo/guest/register", "447:26963"],
  ["forgot-password", "/demo/guest/forgot-password", "447:27322"],
  ["reset-password", "/demo/guest/reset-password", "447:27351"],
  ["verify-email", "/demo/guest/verify-email", "447:27236"],
  ["choose-role", "/demo/guest/choose-role", "447:27300"],
  ["setup-password", "/demo/guest/setup-password", "879:27015"],
  ["traveler-profile", "/demo/traveler/profile", "449:7643"],
  ["preferences", "/demo/traveler/preferences", "92:3394"],
  ["survey", "/demo/traveler/survey", "447:28165"],
  ["traveler-notifications", "/demo/traveler/notifications", "447:27930"],
  ["my-guides", "/demo/traveler/my-guides", "447:29515"],
  ["new-guide", "/demo/traveler/guides/new", "447:29079"],
  ["share-itinerary", "/demo/traveler/roadmaps/share", "447:29323"],
  ["trips", "/demo/traveler/roadmaps", "447:28816"],
  ["new-trip", "/demo/traveler/roadmaps/new", "39:3988"],
  ["roadmap", "/demo/traveler/roadmaps/ha-noi", "24:1383"],
  [
    "roadmap-readonly",
    "/demo/traveler/roadmaps/ha-noi?view=readonly",
    "168:2274",
  ],
  ["dish-roll", "/demo/traveler/roll", "842:13062"],
  ["owner-overview", "/demo/owner", "465:49823"],
  ["owner-information", "/demo/owner/profile", "465:50294"],
  ["owner-photos", "/demo/owner/profile?tab=photos", "465:50454"],
  ["owner-hours", "/demo/owner/profile?tab=hours", "465:50596"],
  ["owner-statuses", "/demo/owner/profile?tab=status", "465:50782"],
  ["owner-verification", "/demo/owner/verification", "465:51167"],
  ["owner-menu", "/demo/owner/menu", "465:51548"],
  ["owner-reviews", "/demo/owner/reviews", "465:52828"],
  ["owner-notifications", "/demo/owner/notifications", "465:53153"],
  ["owner-account", "/demo/owner/account", "465:49410"],
  ["mod-overview", "/demo/moderator", "486:8470"],
  ["mod-users", "/demo/moderator/users", "491:32758"],
  ["mod-user-detail", "/demo/moderator/users/user-2", "491:32912"],
  ["mod-restaurants", "/demo/moderator/restaurants", "491:33245"],
  ["mod-restaurant-detail", "/demo/moderator/restaurants/bep-nha", "491:33419"],
  ["mod-verification", "/demo/moderator/verification", "491:33771"],
  [
    "mod-verification-detail",
    "/demo/moderator/verification/bep-nha",
    "491:33909",
  ],
  ["mod-menu-queue", "/demo/moderator/menus", "491:34178"],
  ["mod-menu-comparison", "/demo/moderator/menus/bep-nha", "491:34326"],
  ["mod-reports", "/demo/moderator/reports", "491:34643"],
  ["mod-restaurant-report", "/demo/moderator/reports/report-1", "491:34815"],
  ["mod-blog-report", "/demo/moderator/reports/report-2", "491:34944"],
  ["mod-community", "/demo/moderator/community", "491:35283"],
  ["mod-reviews", "/demo/moderator/reviews", "491:35644"],
  ["mod-notifications", "/demo/moderator/notifications", "491:36386"],
  ["mod-account", "/demo/moderator/account", "491:35966"],
  ["admin-overview", "/demo/admin", "879:14277"],
  ["admin-directory", "/demo/admin/moderators", "879:26808"],
  ["admin-mod-detail", "/demo/admin/moderators/mod-1", "879:27266"],
  [
    "admin-individual-permissions",
    "/demo/admin/moderators/mod-1/permissions",
    "879:27559",
  ],
  ["admin-default-permissions", "/demo/admin/permissions", "879:27956"],
  ["admin-audit", "/demo/admin/audit", "879:15209"],
  ["admin-sync", "/demo/admin/sync", "879:15624"],
  ["admin-moderation", "/demo/admin/moderation/users", "491:32758"],
  ["gallery", "/dev/components", "462:5031"],
  ["live-unavailable", "/", "contract-gap"],
  ["invalid-password-token", "/reset-password", "447:27351"],
];
const selectedNames = process.env.VISUAL_NAMES?.split(",");
const routes = selectedNames
  ? allRoutes.filter(([name]) => selectedNames.includes(name))
  : allRoutes;
const previous =
  selectedNames && fs.existsSync("artifacts/screenshots/manifest.json")
    ? JSON.parse(fs.readFileSync("artifacts/screenshots/manifest.json", "utf8"))
    : null;
const browser = await chromium.launch({ headless: true }),
  errors = [],
  manifest = [];
fs.mkdirSync("artifacts/screenshots", { recursive: true });
for (const width of [1920, 1440, 390]) {
  const page = await browser.newPage({
    viewport: { width, height: width === 390 ? 844 : 1080 },
    locale: "vi-VN",
  });
  page.on("pageerror", (error) =>
    errors.push({ width, url: page.url(), message: error.message }),
  );
  for (const [name, path, node] of routes) {
    const response = await page.goto(base + path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    // Suppress only Next's development indicator for a clean application capture.
    await page.addStyleTag({ content: "nextjs-portal{display:none}" });
    const file = `artifacts/screenshots/${name}-${width}.png`;
    await page.screenshot({ path: file, fullPage: true });
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      brokenImages: Array.from(document.images)
        .filter(
          (i) =>
            (i.currentSrc && !i.complete) ||
            (i.complete &&
              i.naturalWidth === 0 &&
              !i.closest("dialog:not([open])")),
        )
        .map((i) => i.getAttribute("src")),
    }));
    const record = {
      name,
      path,
      node,
      width,
      status: response.status(),
      ...dimensions,
      file,
    };
    manifest.push(record);
    if (dimensions.scrollWidth > width + 1)
      errors.push({
        width,
        path,
        message: `Horizontal overflow ${dimensions.scrollWidth}`,
      });
    if (response.status() !== 200)
      errors.push({ width, path, message: `HTTP ${response.status()}` });
    if (dimensions.brokenImages.length)
      errors.push({
        width,
        path,
        message: "Broken assets",
        images: dimensions.brokenImages,
      });
  }
  await page.close();
  console.log(`Captured ${routes.length} pages at ${width}px`);
}
await browser.close();
fs.writeFileSync(
  "artifacts/screenshots/manifest.json",
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      manifest: previous
        ? [
            ...previous.manifest.filter((r) => !selectedNames.includes(r.name)),
            ...manifest,
          ]
        : manifest,
      errors: previous
        ? [
            ...previous.errors.filter(
              (r) =>
                !routes.some(
                  ([, path]) => path === r.path || base + path === r.url,
                ),
            ),
            ...errors,
          ]
        : errors,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ captures: manifest.length, errors }, null, 2));
if (errors.length) process.exitCode = 1;
