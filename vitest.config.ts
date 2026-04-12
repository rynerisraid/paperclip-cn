import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Windows full-suite runs can starve heavy embedded-postgres/worktree suites
    // when Vitest fans out every project at once. A small global cap keeps
    // `pnpm test:run` stable without changing individual suite semantics.
    maxWorkers: process.platform === "win32" ? 4 : undefined,
    projects: [
      "packages/db",
      "packages/desktop-electron",
      "packages/adapters/codex-local",
      "packages/adapters/opencode-local",
      "server",
      "ui",
      "cli",
    ],
  },
});
