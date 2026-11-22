import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Unit/integration tests run in plain Node. Component tests (if we add
    // them) can opt into a browser-like environment per-file.
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      exclude: ["src/generated/**", "**/*.config.*", "src/components/ui/**"],
    },
  },
});
