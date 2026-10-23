import { defineConfig } from "@playwright/test";
import config from "./playwright.menu-live.config";
/** Real local OWN-17, fresh disposable accounts, no uploads or Mapbox requests. */
export default defineConfig({ ...config, testMatch: "menu-approval.spec.ts" });
