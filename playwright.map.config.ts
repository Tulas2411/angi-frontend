import { defineConfig } from "@playwright/test";
import owner, { ownerServer } from "./playwright.owner.config";

/**
 * Registration, profile, Mapbox picker and province/ward suites. The token is a placeholder, not a
 * credential: every Mapbox request is intercepted by the specs (see tests/browser/mapbox-fixture.ts).
 */
export default defineConfig({
  ...owner,
  testMatch: [
    "restaurant-registration.spec.ts",
    "restaurant-profile.spec.ts",
    "mapbox.spec.ts",
    "provinces.spec.ts",
    "home-nearby.spec.ts",
  ],
  webServer: ownerServer("pk.angi-tests-placeholder"),
});
