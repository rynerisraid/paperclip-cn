import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveNpmInvocation } from "../services/npm-command.js";

function existsOnly(paths: string[]) {
  const existing = new Set(paths);
  return (candidate: string) => existing.has(candidate);
}

describe("resolveNpmInvocation", () => {
  it("uses npm_execpath when it points at npm-cli.js", () => {
    const npmCli = path.posix.resolve("/opt/node/lib/node_modules/npm/bin/npm-cli.js");

    expect(resolveNpmInvocation({
      env: { npm_execpath: npmCli },
      execPath: "/opt/node/bin/node",
      exists: existsOnly([npmCli]),
      platform: "linux",
    })).toEqual({
      command: "/opt/node/bin/node",
      argsPrefix: [npmCli],
      source: "npm_execpath",
    });
  });

  it("ignores pnpm npm_execpath and finds Windows npm-cli.js from PATH", () => {
    const nodeDir = path.win32.resolve("C:\\Program Files\\nodejs");
    const npmCli = path.win32.join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js");

    expect(resolveNpmInvocation({
      env: {
        npm_execpath: "C:\\Users\\alice\\AppData\\Local\\pnpm\\pnpm.cjs",
        Path: nodeDir,
      },
      execPath: "C:\\Program Files\\Paperclip CN\\Paperclip CN.exe",
      exists: existsOnly([npmCli]),
      platform: "win32",
    })).toEqual({
      command: "C:\\Program Files\\Paperclip CN\\Paperclip CN.exe",
      argsPrefix: [npmCli],
      source: "path_npm_cli",
    });
  });

  it("falls back to a Windows npm.cmd shim when npm-cli.js is not discoverable", () => {
    const nodeDir = path.win32.resolve("C:\\nodejs");
    const npmShim = path.win32.join(nodeDir, "npm.cmd");

    expect(resolveNpmInvocation({
      env: {
        ComSpec: "C:\\Windows\\System32\\cmd.exe",
        Path: nodeDir,
      },
      execPath: "C:\\Program Files\\Paperclip CN\\Paperclip CN.exe",
      exists: existsOnly([npmShim]),
      platform: "win32",
    })).toEqual({
      command: "C:\\Windows\\System32\\cmd.exe",
      argsPrefix: ["/d", "/s", "/c", npmShim],
      source: "path_npm_shim",
    });
  });

  it("throws a clear error when npm cannot be found", () => {
    expect(() => resolveNpmInvocation({
      env: { PATH: "" },
      exists: existsOnly([]),
      platform: "linux",
    })).toThrow("npm executable not found");
  });
});
