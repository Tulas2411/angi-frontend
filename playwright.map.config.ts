import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "mapbox.spec.ts",
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    locale: "vi-VN",
    viewport: { width: 1920, height: 1080 },
    trace: "off",
  },
  webServer: {
    command: "node scripts/owner-test-server.mjs",
    url: "http://localhost:3001/demo",
    reuseExistingServer: false,
    timeout: 240000,
    env: {
      API_BASE_URL: "http://127.0.0.1:5154/api/v1",
      NEXT_PUBLIC_API_BASE_URL: "/api",
      APP_URL: "http://localhost:3001",
      SESSION_PASSWORD: "angi-mapbox-local-browser-test-session-only",
      NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "pk.angi-tests-placeholder",
      NEXT_PUBLIC_ENABLE_DEMO: "true",
      NEXT_PUBLIC_ENABLE_COMPONENT_GALLERY: "true",
    },
  },
});
