import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveTsxCli() {
  const candidatePaths = [
    path.resolve(rootDir, "server", "node_modules", "tsx", "dist", "cli.mjs"),
    path.resolve(rootDir, "cli", "node_modules", "tsx", "dist", "cli.mjs"),
    path.resolve(rootDir, "node_modules", "tsx", "dist", "cli.mjs"),
  ];

  for (const candidatePath of candidatePaths) {
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  const searchPaths = [
    rootDir,
    path.resolve(rootDir, "server"),
    path.resolve(rootDir, "cli"),
  ];

  for (const searchPath of searchPaths) {
    try {
      return require.resolve("tsx/dist/cli.mjs", { paths: [searchPath] });
    } catch {
      // Try the next workspace that may provide tsx.
    }
  }

  throw new Error(
    "Could not resolve tsx from the repo, server, or cli workspace installs. Run `pnpm install` first.",
  );
}

const tsxCliPath = resolveTsxCli();
const child = spawn(process.execPath, [tsxCliPath, ...process.argv.slice(2)], {
  cwd: rootDir,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
