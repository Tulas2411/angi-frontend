import { defineConfig } from "@playwright/test";

const api = new URL(process.env.API_BASE_URL ?? "http://127.0.0.1:5154/api/v1");
if (!["localhost", "127.0.0.1"].includes(api.hostname))
  throw new Error("Live checks require the isolated local backend.");
for (const name of [
  "SESSION_PASSWORD",
  "ANGI_TEST_PASSWORD",
  "ANGI_TEST_TRAVELER_EMAIL",
  "ANGI_TEST_OWNER_EMAIL",
  "ANGI_TEST_OWNER_NEW_EMAIL",
  "ANGI_TEST_MOD_EMAIL",
  "ANGI_TEST_ADMIN_EMAIL",
])
  if (!process.env[name])
    throw new Error(
      `${name} is required. Put the live-test variables in the ignored .env.integration (see docs/live-backend-verification.md).`,
    );

/**
 * Real frontend + real local backend with your own accounts: no API stubs, no request
 * interception. Mapbox and Google are disabled, and no test uploads files to media storage.
 */
export default defineConfig({
  testDir: "./tests/live",
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    locale: "vi-VN",
    // Login payloads contain credentials; never record traces or HARs.
    trace: "off",
  },
  webServer: {
    command: process.env.ANGI_TEST_DEV
      ? "node scripts/owner-test-server.mjs"
      : "node scripts/owner-test-server.mjs --production",
    url: "http://localhost:3001/login",
    reuseExistingServer: false,
    timeout: 240000,
    env: {
      API_BASE_URL: api.toString().replace(/\/$/, ""),
      NEXT_PUBLIC_API_BASE_URL: "/api",
      APP_URL: "http://localhost:3001",
      NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: "",
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_OPTIONS: "",
    },
  },
});
