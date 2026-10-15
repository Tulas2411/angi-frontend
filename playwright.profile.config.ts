import { defineConfig } from "@playwright/test";

/** Tests use an isolated source snapshot, API stub, and test-only encrypted session. */
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "restaurant-profile.spec.ts",
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
    command: "node scripts/owner-test-server.mjs",
    url: "http://localhost:3001/demo",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      API_BASE_URL: "http://127.0.0.1:5164/api/v1",
      NEXT_PUBLIC_API_BASE_URL: "/api",
      APP_URL: "http://localhost:3001",
      SESSION_PASSWORD: "angi-owner-tests-isolated-local-session-key-only",
      NEXT_PUBLIC_DATA_MODE: "live",
      NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "",
      NEXT_PUBLIC_ENABLE_DEMO: "true",
      NEXT_PUBLIC_ENABLE_COMPONENT_GALLERY: "true",
    },
  },
});
