import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: { globals: globals.node },
    rules: {
      // Floating promises and unused vars are real bugs here; `_`-prefixed args are intentional.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Server code logs to stdout/stderr on purpose; flag it so new logs are deliberate.
      "no-console": "warn",
    },
  },
  {
    // CLI scripts and tests print by design.
    files: ["src/scripts/**/*.ts", "tests/**/*.ts"],
    rules: { "no-console": "off" },
  },
);
