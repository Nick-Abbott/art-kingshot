import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import globals from "globals";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import playwright from "eslint-plugin-playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const airbnbRelaxedRules = {
  "arrow-body-style": "off",
  "class-methods-use-this": "off",
  "import/extensions": "off",
  "import/no-extraneous-dependencies": "off",
  "import/no-named-as-default": "off",
  "import/no-named-as-default-member": "off",
  "import/no-unresolved": "off",
  "import/prefer-default-export": "off",
  "no-continue": "off",
  "no-restricted-syntax": "off",
  "no-shadow": "off",
  "no-underscore-dangle": "off",
  "no-use-before-define": "off",
  "react/destructuring-assignment": "off",
  "react/jsx-filename-extension": "off",
  "react/jsx-props-no-spreading": "off",
  "react/react-in-jsx-scope": "off"
};

const ignores = {
  ignores: [
    "**/dist/**",
    "node_modules/**",
    "snapshots/**",
    "test-results/**",
    "server/data/**",
    "server/db/migrations/**"
  ]
};

export default [
  ignores,
  ...tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    importPlugin.flatConfigs.recommended,
    react.configs.flat.recommended,
    ...compat.extends("plugin:jsx-a11y/recommended"),
    {
      languageOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        globals: globals.node
      },
      plugins: {
        "react-hooks": reactHooks,
        playwright
      },
      settings: {
        react: { version: "detect" },
        "import/resolver": {
          typescript: true,
          node: { extensions: [".js", ".jsx", ".ts", ".tsx"] }
        }
      },
      rules: {
        ...airbnbRelaxedRules,
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unused-vars": [
          "warn",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
        ],
        "@typescript-eslint/no-require-imports": "off",
        "import/no-commonjs": "error",
        "prefer-const": "warn",
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn"
      }
    },
    {
      files: ["client/**/*.{ts,tsx,js,jsx}"],
      languageOptions: {
        globals: globals.browser
      },
      rules: {
        "react/prop-types": "off"
      }
    },
    {
      files: ["server/**/*.{ts,js}"],
      rules: {
        "@typescript-eslint/no-require-imports": "off"
      }
    },
    {
      files: [
        "**/*.cjs",
        "scripts/**/*.{js,ts}",
        "client/scripts/**/*.{js,ts}"
      ],
      languageOptions: {
        sourceType: "commonjs",
        globals: globals.node
      },
      rules: {
        "@typescript-eslint/no-require-imports": "off",
        "import/no-commonjs": "off"
      }
    },
    {
      files: [
        "**/*.test.{ts,tsx,js,jsx}",
        "**/__tests__/**/*.{ts,tsx,js,jsx}"
      ],
      rules: {
        "import/no-extraneous-dependencies": "off"
      }
    },
    {
      files: ["playwright/**/*.{ts,tsx,js,jsx}"],
      rules: {
        "playwright/no-conditional-in-test": "off"
      }
    }
  )
];
