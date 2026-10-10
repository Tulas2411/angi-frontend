import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".cache/**",
    "artifacts/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  // Local Figma exports preserve intrinsic SVG geometry; demo uploads use data URLs.
  {
    files: [
      "src/components/brand.tsx",
      "src/components/ui/primitives.tsx",
      "src/components/domain/map-picker.tsx",
      "src/features/roadmaps/pages.tsx",
    ],
    rules: { "@next/next/no-img-element": "off" },
  },
]);

export default eslintConfig;
