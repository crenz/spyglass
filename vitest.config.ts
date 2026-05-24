import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/engine/**",
        "src/schema/**",
        "src/loaders/**",
        "src/player/**",
        "src/state/**",
      ],
      exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts"],
    },
  },
});
