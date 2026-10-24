import { defineConfig } from "@playwright/test";

/** Isolated snapshot server shared by the owner and map suites; only the Mapbox token differs. */
export function ownerServer(mapboxToken = "") {
  return {
    // ANGI_TEST_DEV=1 serves the isolated snapshot with `next dev` instead of a production build.
    command: process.env.ANGI_TEST_DEV
      ? "node scripts/owner-test-server.mjs"
      : "node scripts/owner-test-server.mjs --production",
    url: "http://localhost:3001/login",
    reuseExistingServer: Boolean(process.env.ANGI_TEST_REUSE),
    timeout: 240000,
    env: {
      ANGI_TEST_SOURCE_REF: "",
      API_BASE_URL: "http://127.0.0.1:5164/api/v1",
      NEXT_PUBLIC_API_BASE_URL: "/api",
      APP_URL: "http://localhost:3001",
      SESSION_PASSWORD: "angi-owner-tests-isolated-local-session-key-only",
      NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: mapboxToken,
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: "",
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_OPTIONS: "",
    },
  };
}

/**
 * Owner workspace suites against a local API stub on port 5164 (ports/sessions are test-only).
 * Mapbox is disabled here; map-related suites live in playwright.map.config.ts.
 */
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: [
    "restaurant-business-hours.spec.ts",
    "restaurant-operating-status.spec.ts",
    "restaurant-verification.spec.ts",
    "restaurant-verification-status.spec.ts",
    "verification-resubmission.spec.ts",
    "restaurant-menu.spec.ts",
    "menu-approval.spec.ts",
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
  webServer: ownerServer(),
});
