import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanupStaleEmbeddedPostgresTestRegistrations,
  getAvailablePort,
  removeDataDirWithRetries,
  shutdownManagedEmbeddedPostgres,
  startManagedEmbeddedPostgres,
} from "./embedded-postgres-manager.js";
import { getEmbeddedPostgresTestSupport } from "./test-embedded-postgres.js";

const registryRecordsDir = path.resolve(os.tmpdir(), "paperclip-embedded-postgres-test-registry", "records");

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres manager live tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

afterEach(async () => {
  await cleanupStaleEmbeddedPostgresTestRegistrations().catch(() => undefined);
});

describe("removeDataDirWithRetries", () => {
  it("retries retryable directory removal failures and stays idempotent", async () => {
    const rm = vi.fn<typeof fs.rm>()
      .mockRejectedValueOnce(Object.assign(new Error("busy"), { code: "EPERM" }))
      .mockRejectedValueOnce(Object.assign(new Error("busy"), { code: "ENOTEMPTY" }))
      .mockResolvedValue(undefined);
    const sleep = vi.fn(async () => undefined);

    await removeDataDirWithRetries("C:/tmp/paperclip-test-db", { rm, sleep });
    await removeDataDirWithRetries("C:/tmp/paperclip-test-db", {
      rm: vi.fn<typeof fs.rm>().mockResolvedValue(undefined),
      sleep,
    });

    expect(rm).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});

describe("cleanupStaleEmbeddedPostgresTestRegistrations", () => {
  it("only cleans stale registry entries whose owner process is gone", async () => {
    const staleRecord = {
      createdAt: "2026-04-05T10:00:00.000Z",
      dataDir: "C:/tmp/paperclip-stale-db",
      id: "stale-record",
      ownerPid: 111,
      pgCtlPath: null,
      port: 54321,
      postmasterPid: 333,
      postgresPath: "C:/tmp/postgres.exe",
      version: 1 as const,
    };
    const liveRecord = {
      ...staleRecord,
      dataDir: "C:/tmp/paperclip-live-db",
      id: "live-record",
      ownerPid: 222,
      postmasterPid: 444,
    };
    const removedFiles: string[] = [];

    const result = await cleanupStaleEmbeddedPostgresTestRegistrations({
      execFile: async () => ({ exitCode: 0, stderr: "", stdout: "" }),
      forceKillProcessTree: async () => undefined,
      isPidAlive: (pid) => pid === liveRecord.ownerPid,
      listPostgresProcesses: async () => [],
      readDir: async () => ["stale-record.json", "live-record.json"],
      readJson: async <T>(filePath: string) => {
        if (filePath.endsWith("stale-record.json")) return staleRecord as T;
        if (filePath.endsWith("live-record.json")) return liveRecord as T;
        return null;
      },
      removeFile: async (filePath) => {
        removedFiles.push(path.basename(filePath));
      },
      removePostmasterPid: () => undefined,
      rm: async () => undefined,
      sleep: async () => undefined,
      writeJson: async () => undefined,
    });

    expect(result.cleaned).toEqual(["stale-record"]);
    expect(result.skipped).toEqual(["live-record"]);
    expect(removedFiles).toEqual(["stale-record.json"]);
  });
});

describe("shutdownManagedEmbeddedPostgres", () => {
  it("falls back to process-tree cleanup when pg_ctl stop fails", async () => {
    const alivePids = new Set([401, 402]);
    const killedPids: number[] = [];
    const dataDir = "C:/tmp/paperclip-fallback-db";
    const listPostgresProcesses = vi.fn(async () =>
      Array.from(alivePids).map((pid) => ({
        commandLine: `postgres.exe -D ${dataDir}`,
        parentPid: null,
        pid,
      })),
    );

    await shutdownManagedEmbeddedPostgres(
      {
        dataDir,
        pgCtlPath: "C:/tmp/pg_ctl.exe",
        postmasterPid: 401,
      },
      {
        execFile: async () => {
          throw new Error("pg_ctl failed");
        },
        forceKillProcessTree: async (pid) => {
          killedPids.push(pid);
          alivePids.delete(pid);
        },
        isPidAlive: (pid) => alivePids.has(pid),
        listPostgresProcesses,
        removePostmasterPid: vi.fn(),
      },
    );

    expect(killedPids).toContain(401);
    expect(listPostgresProcesses).toHaveBeenCalled();
  });
});

describeEmbeddedPostgres("startManagedEmbeddedPostgres", () => {
  it("starts and stops a managed test cluster while cleaning its registry entry", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-managed-live-"));
    const preferredPort = await getAvailablePort();
    const handle = await startManagedEmbeddedPostgres({
      dataDir,
      preferredPort,
      registerTestInstance: true,
    });

    try {
      const entriesBefore = await fs.readdir(registryRecordsDir).catch(() => []);
      const matchingBefore = await Promise.all(
        entriesBefore
          .filter((entry) => entry.endsWith(".json"))
          .map(async (entry) => {
            const filePath = path.resolve(registryRecordsDir, entry);
            const raw = JSON.parse(await fs.readFile(filePath, "utf8")) as { dataDir?: string };
            return raw.dataDir === dataDir ? entry : null;
          }),
      );
      expect(matchingBefore.filter(Boolean)).toHaveLength(1);

      await handle.stop();
      await removeDataDirWithRetries(dataDir);

      const entriesAfter = await fs.readdir(registryRecordsDir).catch(() => []);
      const matchingAfter = await Promise.all(
        entriesAfter
          .filter((entry) => entry.endsWith(".json"))
          .map(async (entry) => {
            const filePath = path.resolve(registryRecordsDir, entry);
            const raw = JSON.parse(await fs.readFile(filePath, "utf8")) as { dataDir?: string };
            return raw.dataDir === dataDir ? entry : null;
          }),
      );
      expect(matchingAfter.filter(Boolean)).toHaveLength(0);
    } finally {
      await handle.stop().catch(() => undefined);
      await removeDataDirWithRetries(dataDir).catch(() => undefined);
    }
  }, 20_000);
});
