import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "playwright-report",
      "test-results",
      "node_modules",
      ".vite",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        URL: "readonly",
        HTMLElement: "readonly",
        HTMLImageElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLDivElement: "readonly",
        Event: "readonly",
        KeyboardEvent: "readonly",
        MouseEvent: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Engine purity: src/engine/ must remain UI/DOM-free.
  {
    files: ["src/engine/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "react-dom/*"],
              message: "Engine is UI-free. No React imports.",
            },
            {
              group: ["konva", "react-konva"],
              message: "Engine is UI-free. No Konva imports.",
            },
            {
              group: ["zustand", "zustand/*"],
              message: "Engine is pure. State stores live in src/state/.",
            },
            {
              group: [
                "@/player/*",
                "@/editor/*",
                "@/state/*",
                "@/components/*",
              ],
              message: "Engine must not depend on UI/state layers.",
            },
          ],
          paths: [
            { name: "react", message: "Engine is UI-free." },
            { name: "react-dom", message: "Engine is UI-free." },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "window", message: "Engine is DOM-free." },
        { name: "document", message: "Engine is DOM-free." },
        { name: "navigator", message: "Engine is DOM-free." },
        {
          name: "Audio",
          message: "Engine emits audio intents; the player driver plays them.",
        },
        {
          name: "AudioContext",
          message: "Engine emits audio intents; the player driver plays them.",
        },
        {
          name: "HTMLAudioElement",
          message: "Engine emits audio intents; the player driver plays them.",
        },
      ],
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}", "**/*.test.{ts,tsx}", "vitest.setup.ts"],
    languageOptions: {
      globals: {
        ...Object.fromEntries(
          [
            "describe",
            "it",
            "test",
            "expect",
            "beforeEach",
            "afterEach",
            "beforeAll",
            "afterAll",
            "vi",
          ].map((g) => [g, "readonly"]),
        ),
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  prettier,
);
