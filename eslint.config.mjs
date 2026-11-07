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
    // Jesse's ATLAS desktop app (Electron, CommonJS; its own project).
    "atlas-desktop/**",
    // Standalone trailer project (browser + Node render scripts).
    "trailer/**",
    "teaser-002/**",
    "break-the-feed/**",
    "promo-03/**",
    // Welcome film project (capture, canvas composition, render scripts).
    "welcome/**",
    // Remotion reel project (its own package, lint and tsconfig).
    "reels/**",
  ]),
]);

export default eslintConfig;
