import { defineConfig } from "@playwright/test";

const api = new URL(process.env.API_BASE_URL ?? "http://127.0.0.1:5154/api/v1");
const run = process.env.ANGI_LOCAL_TEST_RUN;
if (
  !["localhost", "127.0.0.1"].includes(api.hostname) ||
  !run ||
  !/^[a-z0-9-]{1,40}$/.test(run) ||
  process.env.ANGI_TEST_OWNER_EMAIL !== `owner-${run}@angi.local` ||
  process.env.ANGI_TEST_EMPTY_OWNER_EMAIL !== `empty-${run}@angi.local` ||
  !process.env.ANGI_TEST_PASSWORD ||
  !process.env.SESSION_PASSWORD
)
  throw new Error(
    "Seed fresh isolated local owners and load their test env first.",
  );

/** Real local Kestrel/PostgreSQL/Cloudinary; never opens a map or probes Mapbox. */
export default defineConfig({
  testDir: "./tests/live",
  testMatch: "restaurant-verification.spec.ts",
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    locale: "vi-VN",
    serviceWorkers: "block",
    // Passwords and signed document URLs must never enter recorded traces.
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  webServer: {
    command: "node scripts/owner-test-server.mjs --production",
    url: "http://localhost:3001/login",
    timeout: 240000,
    reuseExistingServer: false,
    env: {
      ANGI_TEST_SOURCE_REF: "",
      API_BASE_URL: api.toString().replace(/\/$/, ""),
      APP_URL: "http://localhost:3001",
      NEXT_PUBLIC_API_BASE_URL: "/api",
      NEXT_PUBLIC_DATA_MODE: "live",
      NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: "",
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_OPTIONS: "",
    },
  },
});
