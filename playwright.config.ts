import { defineConfig } from "@playwright/test";

/**
 * Default suite: public pages, auth pages and role landings on an isolated production build.
 * A local auth stub (port 5164) answers login only; no provider or shared backend is used.
 * Owner suites have their own `playwright.*.config.ts` files that reuse the same server setup.
 */
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: [
    "public-home.spec.ts",
    "auth-flows.spec.ts",
    "routes.spec.ts",
    "account.spec.ts",
  ],
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    locale: "vi-VN",
    trace: "retain-on-failure",
  },
  webServer: {
    // ANGI_TEST_DEV=1 serves the isolated snapshot with `next dev` instead of a production build.
    command: process.env.ANGI_TEST_DEV
      ? "node scripts/owner-test-server.mjs"
      : "node scripts/owner-test-server.mjs --production",
    url: "http://localhost:3001/",
    reuseExistingServer: Boolean(process.env.ANGI_TEST_REUSE),
    timeout: 240000,
    env: {
      ANGI_TEST_SOURCE_REF: "",
      API_BASE_URL: "http://127.0.0.1:5164/api/v1",
      NEXT_PUBLIC_API_BASE_URL: "/api",
      APP_URL: "http://localhost:3001",
      SESSION_PASSWORD: "angi-homepage-local-test-session-key-only",
      NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: "",
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_OPTIONS: "",
    },
  },
});
