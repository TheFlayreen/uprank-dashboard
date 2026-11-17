import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Project conventions (see CONVENTIONS.md) — enforced, not just documented.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // One component per file.
      "react/no-multi-comp": ["error", { ignoreStateless: false }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
    },
  },
  {
    // Components must not pull runtime code from the server layer (type-only imports are fine).
    files: ["src/components/**/*.{ts,tsx}", "src/lib/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/server/*", "@/server/**"], allowTypeImports: true, message: "Components may only import types from server/. Pass data via props." }] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
]);

export default eslintConfig;
