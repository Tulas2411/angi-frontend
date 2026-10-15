import { defineConfig } from "@playwright/test";
import profileConfig from "./playwright.profile.config";

/** OWN-04 uses the same isolated server/session setup as OWN-02/03. Run sequentially. */
export default defineConfig({
  ...profileConfig,
  testMatch: "restaurant-business-hours.spec.ts",
});
