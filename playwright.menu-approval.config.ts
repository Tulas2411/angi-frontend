import { defineConfig } from "@playwright/test";
import config from "./playwright.menu.config";
/** OWN-17 plus affected F50 proxy/UI regressions; local stub and Mapbox disabled. */
export default defineConfig({
  ...config,
  testMatch: ["menu-approval.spec.ts", "restaurant-menu.spec.ts"],
});
