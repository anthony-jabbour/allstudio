import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: [
      "packages/**/tests/**/*.test.ts",
      "packages/**/tests/**/*.test.tsx",
      "tests/**/*.test.ts",
    ],
  },
});
