import { defineConfig } from "@playwright/test";
import maps from "./playwright.map.config";

export default defineConfig({ ...maps, testMatch: "provinces.spec.ts" });
