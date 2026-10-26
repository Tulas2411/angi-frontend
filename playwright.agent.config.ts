import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** Local backend fixtures and blank Mapbox token: no provider calls or credentials. */
export default defineConfig({ ...base, testMatch: "roadmap-agent.spec.ts" });
