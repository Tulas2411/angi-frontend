import { defineConfig } from "@playwright/test";
import profileConfig from "./playwright.profile.config";

/** OWN-05 uses the isolated owner API/session setup. Run owner suites sequentially. */
export default defineConfig({
  ...profileConfig,
  testMatch: "restaurant-operating-status.spec.ts",
});
