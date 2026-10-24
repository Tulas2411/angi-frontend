import { defineConfig } from "@playwright/test";
import config from "./playwright.verification-live.config";
export default defineConfig({
  ...config,
  testMatch: "restaurant-menu.spec.ts",
  timeout: 180000,
});
