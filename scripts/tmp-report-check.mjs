import { chromium } from "@playwright/test";

const base = "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

await page.goto(`${base}/demo/traveler/guides/guide-2`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: "nextjs-portal{display:none}" });

const pill = page.locator("button", { hasText: "Báo cáo bài viết" }).first();
await pill.click();
await page.waitForTimeout(500);

const info = await page.evaluate(() => {
  const fs = document.querySelector(".report-reasons");
  if (!fs) return { found: false };
  const cs = getComputedStyle(fs);
  const items = Array.from(fs.querySelectorAll(".choice")).map((el) => {
    const r = el.getBoundingClientRect();
    return { text: el.textContent.trim(), top: Math.round(r.top), left: Math.round(r.left) };
  });
  return {
    found: true,
    display: cs.display,
    flexDirection: cs.flexDirection,
    items,
  };
});
console.log(JSON.stringify(info, null, 2));

const dialog = page.locator("dialog[open]");
await dialog.screenshot({ path: "artifacts/report-dialog.png" });
console.log("screenshot saved");
await browser.close();
