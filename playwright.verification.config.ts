import { defineConfig } from "@playwright/test";
import profileConfig from "./playwright.profile.config";

/** F-47 uses a local API stub. No Mapbox token, live uploads or external services. */
export default defineConfig({
  ...profileConfig,
  testMatch: "restaurant-verification.spec.ts",
  webServer: {
    command: "node scripts/owner-test-server.mjs --production",
    url: "http://localhost:3001/demo",
    reuseExistingServer: false,
    timeout: 240000,
    env: {
      ANGI_TEST_SOURCE_REF: "",
      API_BASE_URL: "http://127.0.0.1:5164/api/v1",
      NEXT_PUBLIC_API_BASE_URL: "/api",
      APP_URL: "http://localhost:3001",
      SESSION_PASSWORD: "angi-verification-local-test-session-key-only",
      NEXT_PUBLIC_DATA_MODE: "live",
      NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "",
      NEXT_PUBLIC_ENABLE_DEMO: "true",
      NEXT_PUBLIC_ENABLE_COMPONENT_GALLERY: "true",
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_OPTIONS: "",
    },
  },
});
