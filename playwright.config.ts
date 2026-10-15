import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  // Owner operations use their separate API/session configurations.
  testIgnore: [
    "restaurant-registration.spec.ts",
    "restaurant-profile.spec.ts",
    "restaurant-business-hours.spec.ts",
    "mapbox.spec.ts",
    "restaurant-operating-status.spec.ts",
  ],
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    locale: "vi-VN",
    viewport: { width: 1920, height: 1080 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3000",
    url: "http://localhost:3000/demo",
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN:
        process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
        "pk.angi-tests-placeholder",
    },
  },
});
