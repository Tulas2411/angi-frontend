import { defineConfig } from "@playwright/test";

/** Isolated local API stub and session; never targets a shared backend. */
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "restaurant-registration.spec.ts",
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    locale: "vi-VN",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3001",
    url: "http://localhost:3001/demo",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      API_BASE_URL: "http://127.0.0.1:5164/api/v1",
      NEXT_PUBLIC_API_BASE_URL: "/api",
      APP_URL: "http://localhost:3001",
      SESSION_PASSWORD: "angi-owner-tests-isolated-local-session-key-only",
      NEXT_PUBLIC_DATA_MODE: "live",
      // Not a provider credential: all Mapbox requests are intercepted by the suite.
      NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "pk.angi-tests-placeholder",
    },
  },
});
