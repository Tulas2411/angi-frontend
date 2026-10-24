import { defineConfig } from "@playwright/test";
import config from "./playwright.verification.config";
export default defineConfig({
  ...config,
  testMatch: "restaurant-menu.spec.ts",
});
