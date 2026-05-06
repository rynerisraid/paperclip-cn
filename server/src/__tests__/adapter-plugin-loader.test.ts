import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { pathToFileURLSpy } = vi.hoisted(() => ({
  pathToFileURLSpy: vi.fn(),
}));

vi.mock("node:url", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:url")>();
  pathToFileURLSpy.mockImplementation(actual.pathToFileURL);
  return {
    ...actual,
    pathToFileURL: pathToFileURLSpy,
  };
});

import { loadExternalAdapterPackage } from "../adapters/plugin-loader.js";

const tempDirs: string[] = [];

afterEach(() => {
  vi.clearAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function makeTempAdapterPackage(): string {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "paperclip-adapter-loader-"));
  tempDirs.push(rootDir);

  mkdirSync(path.join(rootDir, "dist"), { recursive: true });
  writeFileSync(
    path.join(rootDir, "package.json"),
    JSON.stringify(
      {
        name: "@acme/windows-adapter",
        version: "0.1.0",
        type: "module",
        exports: {
          ".": "./dist/index.js",
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    path.join(rootDir, "dist", "index.js"),
    [
      "export function createServerAdapter() {",
      "  return {",
      "    type: 'windows_external_test',",
      "    async execute() { return { exitCode: 0, signal: null, timedOut: false }; },",
      "  };",
      "}",
      "",
    ].join("\n"),
  );

  return rootDir;
}

describe("adapter plugin loader", () => {
  it("converts adapter entrypoints to file URLs before dynamic import", async () => {
    const packageDir = makeTempAdapterPackage();

    const adapter = await loadExternalAdapterPackage("@acme/windows-adapter", packageDir);

    expect(adapter.type).toBe("windows_external_test");
    expect(pathToFileURLSpy).toHaveBeenCalledWith(
      path.join(packageDir, "dist", "index.js"),
    );
  });
});
