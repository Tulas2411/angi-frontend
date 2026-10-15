import { defineConfig } from "@playwright/test";

const api = new URL(process.env.API_BASE_URL ?? "http://127.0.0.1:5154/api/v1");
if (!["localhost", "127.0.0.1"].includes(api.hostname))
  throw new Error("Live checks require the isolated local backend.");
if (!process.env.SESSION_PASSWORD || !process.env.ANGI_TEST_PASSWORD)
  throw new Error(
    "Load the ignored .env.integration before running live checks.",
  );

/** Real Kestrel + PostgreSQL; no API stubs or request interception. */
export default defineConfig({
  testDir: "./tests/live",
  testMatch:
    process.env.ANGI_TEST_OWNER_TASKS === "1"
      ? "owner-tasks.spec.ts"
      : "real-backend.spec.ts",
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  reporter:
    process.env.ANGI_TEST_OWNER_TASKS === "1"
      ? [
          ["list"],
          [
            "json",
            {
              outputFile: `artifacts/owner-tasks-${process.env.ANGI_TEST_SOURCE_REF === "dev" ? "dev" : "working"}.json`,
            },
          ],
        ]
      : "list",
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    locale: "vi-VN",
    // Auth payloads contain credentials; do not record traces/HARs.
    trace: "off",
  },
  webServer: {
    command: "node scripts/owner-test-server.mjs",
    url: "http://localhost:3001/login",
    reuseExistingServer: false,
    timeout: 240000,
    env: {
      API_BASE_URL: api.toString().replace(/\/$/, ""),
      NEXT_PUBLIC_API_BASE_URL: "/api",
      APP_URL: "http://localhost:3001",
      // The secret is inherited from the parent env, never serialized into JSON reports.
      NEXT_PUBLIC_DATA_MODE: "live",
      NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "",
    },
  },
});
