import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveCommandForLogs, runChildProcess } from "./server-utils.js";

const itWindows = process.platform === "win32" ? it : it.skip;
const cleanups: string[] = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const target = cleanups.pop();
    if (!target) continue;
    await fs.rm(target, { recursive: true, force: true }).catch(() => {});
  }
});

describe("resolveCommandForLogs", () => {
  itWindows("prefers PATHEXT command shims over bare npm shell shims on Windows", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-command-resolution-"));
    cleanups.push(tempDir);

    const bareShimPath = path.join(tempDir, "opencode");
    const cmdShimPath = path.join(tempDir, "opencode.cmd");

    await fs.writeFile(
      bareShimPath,
      "#!/bin/sh\nexit 1\n",
      "utf8",
    );
    await fs.writeFile(
      cmdShimPath,
      "@ECHO off\r\nEXIT /b 0\r\n",
      "utf8",
    );

    const resolved = await resolveCommandForLogs("opencode", tempDir, {
      ...process.env,
      PATH: tempDir,
      PATHEXT: ".EXE;.CMD;.BAT;.COM",
    });

    expect(path.normalize(resolved)).toBe(path.normalize(cmdShimPath));
  });
});

function isPidAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForPidExit(pid: number, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return !isPidAlive(pid);
}

describe("runChildProcess", () => {
  itWindows("preserves quoted .cmd arguments with spaces and trailing backslashes", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-run-child-cmd-"));
    cleanups.push(tempDir);

    const commandPath = path.join(tempDir, "echo-argv.cmd");
    const nodePath = process.execPath.replace(/\\/g, "\\\\");
    await fs.writeFile(
      commandPath,
      `@echo off\r\n"${nodePath}" -e "process.stdout.write(JSON.stringify(process.argv.slice(1)))" -- %*\r\n`,
      "utf8",
    );

    const trickyArg = "C:\\Users\\chenj\\AppData\\Roaming\\Paperclip CN\\instances\\default\\projects\\demo\\_default\\";
    const result = await runChildProcess(
      randomUUID(),
      commandPath,
      ["--append-system-prompt-file", trickyArg],
      {
        cwd: tempDir,
        env: {},
        timeoutSec: 5,
        graceSec: 1,
        onLog: async () => {},
      },
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(["--append-system-prompt-file", trickyArg]);
  });

  it("waits for onSpawn before sending stdin to the child", async () => {
    const spawnDelayMs = 150;
    const startedAt = Date.now();
    let onSpawnCompletedAt = 0;

    const result = await runChildProcess(
      randomUUID(),
      process.execPath,
      [
        "-e",
        "let data='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>data+=chunk);process.stdin.on('end',()=>process.stdout.write(data));",
      ],
      {
        cwd: process.cwd(),
        env: {},
        stdin: "hello from stdin",
        timeoutSec: 5,
        graceSec: 1,
        onLog: async () => {},
        onSpawn: async () => {
          await new Promise((resolve) => setTimeout(resolve, spawnDelayMs));
          onSpawnCompletedAt = Date.now();
        },
      },
    );
    const finishedAt = Date.now();

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello from stdin");
    expect(onSpawnCompletedAt).toBeGreaterThanOrEqual(startedAt + spawnDelayMs);
    expect(finishedAt - startedAt).toBeGreaterThanOrEqual(spawnDelayMs);
  });

  it.skipIf(process.platform === "win32")("kills descendant processes on timeout via the process group", async () => {
    let descendantPid: number | null = null;

    const result = await runChildProcess(
      randomUUID(),
      process.execPath,
      [
        "-e",
        [
          "const { spawn } = require('node:child_process');",
          "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
          "process.stdout.write(String(child.pid));",
          "setInterval(() => {}, 1000);",
        ].join(" "),
      ],
      {
        cwd: process.cwd(),
        env: {},
        timeoutSec: 1,
        graceSec: 1,
        onLog: async () => {},
        onSpawn: async () => {},
      },
    );

    descendantPid = Number.parseInt(result.stdout.trim(), 10);
    expect(result.timedOut).toBe(true);
    expect(Number.isInteger(descendantPid) && descendantPid > 0).toBe(true);

    expect(await waitForPidExit(descendantPid!, 2_000)).toBe(true);
  });
});
