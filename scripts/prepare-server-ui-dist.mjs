#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const uiDist = path.join(repoRoot, "ui", "dist");
const serverUiDist = path.join(repoRoot, "server", "ui-dist");

function quoteCmdArg(value) {
  if (/^[A-Za-z0-9_/:=.,@+-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function resolvePnpmInvocation(args) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && /pnpm/i.test(npmExecPath)) {
    return { command: process.execPath, args: [npmExecPath, ...args] };
  }
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", ["pnpm", ...args].map(quoteCmdArg).join(" ")],
    };
  }
  return { command: "pnpm", args };
}

console.log("  -> Building @penclipai/ui...");
const pnpmInvocation = resolvePnpmInvocation(["--filter", "@penclipai/ui", "build"]);
const buildResult = spawnSync(pnpmInvocation.command, pnpmInvocation.args, {
  cwd: repoRoot,
  stdio: "inherit",
});

if (buildResult.error) {
  console.error(`Error: failed to spawn pnpm: ${buildResult.error.message}`);
  process.exit(1);
}

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

if (!fs.existsSync(path.join(uiDist, "index.html"))) {
  console.error(`Error: UI build output missing at ${path.join(uiDist, "index.html")}`);
  process.exit(1);
}

fs.rmSync(serverUiDist, { recursive: true, force: true });
fs.cpSync(uiDist, serverUiDist, { recursive: true, force: true });
console.log("  -> Copied ui/dist to server/ui-dist");
