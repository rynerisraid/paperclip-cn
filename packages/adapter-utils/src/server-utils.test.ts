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

describe("runChildProcess", () => {
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
});
