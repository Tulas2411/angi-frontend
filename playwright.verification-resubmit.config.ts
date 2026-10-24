import { defineConfig } from "@playwright/test";
import statusConfig from "./playwright.verification-status.config";

/** OWN-08 and affected OWN-06/07 regressions; local API stub, Mapbox disabled. */
export default defineConfig({
  ...statusConfig,
  testMatch: [
    "restaurant-verification.spec.ts",
    "restaurant-verification-status.spec.ts",
    "verification-resubmission.spec.ts",
  ],
});
