import { defineConfig } from "@playwright/test";
import verificationConfig from "./playwright.verification.config";

/** OWN-07 plus the affected OWN-06 regression suite; local production FE/API stub only. */
export default defineConfig({
  ...verificationConfig,
  testMatch: [
    "restaurant-verification.spec.ts",
    "restaurant-verification-status.spec.ts",
  ],
});
