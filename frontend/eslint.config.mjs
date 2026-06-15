import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Built-in: catches `let undefined = ...`, `let NaN = ...`, etc.
      "no-shadow-restricted-names": "error",
      // Catches declarations that shadow browser globals — the exact bug that
      // crashed Student/Instructor dashboards: `const [window, setWindow] =
      // useState(...)`. Matches Identifier nodes inside binding positions of
      // var/let/const, destructured array/object patterns, and function
      // params.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "VariableDeclarator > Identifier[name='window'], VariableDeclarator ArrayPattern > Identifier[name='window'], VariableDeclarator ObjectPattern Property > Identifier.value[name='window'], :function > Identifier.params[name='window']",
          message:
            "Don't shadow the browser `window` global — pick a different name (e.g. `current`, `win`). This shadow crashed the dashboards in prod.",
        },
        {
          selector:
            "VariableDeclarator > Identifier[name='document'], VariableDeclarator ArrayPattern > Identifier[name='document'], :function > Identifier.params[name='document']",
          message: "Don't shadow the browser `document` global.",
        },
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
  ]),
]);

export default eslintConfig;
