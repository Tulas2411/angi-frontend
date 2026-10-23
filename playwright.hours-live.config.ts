import { defineConfig } from "@playwright/test";
import config from "./playwright.verification-live.config";

/** Fresh local hours-owner account only; no Mapbox or media requests. */
const run = process.env.ANGI_LOCAL_TEST_RUN;
if (process.env.ANGI_TEST_HOURS_OWNER_EMAIL !== `hours-${run}@angi.local`)
  throw new Error(
    "Seed a fresh isolated hours owner and load the test env first.",
  );
export default defineConfig({
  ...config,
  testMatch: "owner-tasks.spec.ts",
  grep: /ANGI-48:/,
});
