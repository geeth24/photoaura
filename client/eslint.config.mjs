import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";

// Errors gate the analysis job; warnings are listed in the report only.
// Style-only sonarjs rules are off: nested ternaries are how JSX conditionals
// read here, `void` marks fire-and-forget promises, and pseudo-random is used
// for UI jitter and retry backoff, not secrets.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ...sonarjs.configs.recommended,
    rules: {
      ...sonarjs.configs.recommended.rules,
      "sonarjs/no-nested-conditional": "off",
      "sonarjs/no-nested-template-literals": "off",
      "sonarjs/void-use": "off",
      "sonarjs/pseudo-random": "off",
      "sonarjs/cognitive-complexity": "warn",
      "sonarjs/super-linear-regex": "warn",
      "sonarjs/no-unenclosed-multiline-block": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-unused-expressions": ["error", { allowTernary: true }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
