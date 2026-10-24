import { defineConfig } from "@playwright/test";
import profileConfig from "./playwright.verification.config";

/** Isolated production build + API stub, empty Mapbox token. Run sequentially. */
export default defineConfig({
  ...profileConfig,
  testMatch: "restaurant-business-hours.spec.ts",
});
