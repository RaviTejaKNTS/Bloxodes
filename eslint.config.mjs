import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off"
    },
    settings: {
      next: {
        rootDir: "apps/web"
      }
    },
    rules: {
      // Existing debt is explicitly baselined so lint can become a blocking gate now.
      // New quality code gets a stricter override below.
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/use-memo": "off",
      "jsx-a11y/role-supports-aria-props": "off",
      "prefer-const": "off",
      "prefer-rest-params": "off"
    }
  },
  {
    files: [
      "scripts/quality/**/*.{ts,tsx}",
      "apps/web/e2e/**/*.{ts,tsx}",
      "apps/web/src/lib/{content-dates,seo-contracts,structured-data}.ts",
      "apps/web/src/lib/__tests__/**/*.{ts,tsx}",
      "playwright.config.ts"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "prefer-const": "error"
    }
  },
  globalIgnores([
    "**/.next/**",
    "**/node_modules/**",
    "**/dist/**",
    "**/coverage/**",
    "tmp/**",
    "apps/web/next-env.d.ts"
  ])
]);
