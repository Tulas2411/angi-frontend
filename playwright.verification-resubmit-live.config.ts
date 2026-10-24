import { defineConfig } from "@playwright/test";
import liveConfig from "./playwright.verification-live.config";

/** Real OWN-08 with explicitly scoped reviewed fixtures; no Moderator API or Mapbox calls. */
export default defineConfig({
  ...liveConfig,
  testMatch: "verification-resubmission.spec.ts",
  timeout: 180000,
});
