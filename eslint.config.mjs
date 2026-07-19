import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";
import sonarjs from "eslint-plugin-sonarjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Bug-pattern + code-smell rules (SonarJS).
  sonarjs.configs.recommended,

  // Import validation + ordering.
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,

  {
    settings: {
      "import-x/resolver": { typescript: true, node: true },
    },
    rules: {
      // ── Import hygiene ──────────────────────────────────────────────
      "import-x/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"], "type"],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          pathGroupsExcludedImportTypes: ["type"],
          "newlines-between": "never",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import-x/no-duplicates": "warn",
      "import-x/newline-after-import": "warn",
      // Next handles module resolution + default exports for pages/routes.
      "import-x/no-unresolved": "off",
      "import-x/no-named-as-default-member": "off",

      // ── Complexity budgets (warn — surfaced, not build-breaking) ────
      complexity: ["warn", 20],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 5],
      "max-nested-callbacks": ["warn", 4],

      // ── SonarJS: keep genuine bug rules as errors; downgrade style /
      //    complexity smells to advisory so they surface without blocking. ──
      "sonarjs/cognitive-complexity": "warn",
      "sonarjs/no-duplicate-string": "warn",
      "sonarjs/no-identical-functions": "warn",
      "sonarjs/no-nested-conditional": "warn",
      "sonarjs/no-nested-template-literals": "warn",
      "sonarjs/no-nested-functions": "warn",
      "sonarjs/super-linear-regex": "warn",
      "sonarjs/unused-import": "warn",
      "sonarjs/todo-tag": "warn",
      "sonarjs/no-commented-code": "off",
      // Deliberate design choices in a self-hosted LAN tool:
      // - md5 is mandated by the Subsonic auth scheme (token = md5(password+salt)).
      // - http:// targets are internal service URLs (navidrome, deemix, localhost).
      // - Math.random powers shuffle / cover gradients — not security-sensitive.
      "sonarjs/hashing": "off",
      "sonarjs/no-clear-text-protocols": "off",
      "sonarjs/pseudo-random": "off",
    },
  },

  // Turn off ESLint rules that conflict with Prettier (must be last).
  prettier,

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
