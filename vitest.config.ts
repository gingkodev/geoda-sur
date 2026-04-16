import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    fileParallelism: false,
    setupFiles: ["./src/tests/setup.ts"],
  },
});
