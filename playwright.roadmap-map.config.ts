import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const server = Array.isArray(base.webServer)
  ? base.webServer[0]
  : base.webServer;
if (!server)
  throw new Error("Expected the isolated local test server configuration.");

/** Real GL renderer with a fake token; provider responses are fulfilled by local fixtures. */
export default defineConfig({
  ...base,
  testMatch: "roadmap-detail.spec.ts",
  grep: /offline Mapbox/,
  webServer: {
    ...server,
    env: {
      ...server.env,
      ANGI_TEST_SOURCE_REF: "",
      API_BASE_URL: "http://127.0.0.1:5164/api/v1",
      NEXT_PUBLIC_API_BASE_URL: "/api",
      APP_URL: "http://localhost:3001",
      SESSION_PASSWORD: "angi-homepage-local-test-session-key-only",
      NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "pk.angi-offline-map-test-only",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: "",
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_OPTIONS: "",
    },
  },
});
