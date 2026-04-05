import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["../packages/db/src/test-embedded-postgres-global-setup.ts"],
    hookTimeout: 30_000,
    teardownTimeout: 30_000,
  },
});
