import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  applyPendingMigrations,
  ensurePostgresDatabase,
} from "./client.js";
import {
  getAvailablePort,
  prepareEmbeddedPostgresTestSupport,
  readCachedEmbeddedPostgresTestSupport,
  removeDataDirWithRetries,
  startManagedEmbeddedPostgres,
  type EmbeddedPostgresTestSupport,
} from "./embedded-postgres-manager.js";

export type EmbeddedPostgresTestDatabase = {
  connectionString: string;
  cleanup(): Promise<void>;
};

export type { EmbeddedPostgresTestSupport } from "./embedded-postgres-manager.js";

let embeddedPostgresSupportPromise: Promise<EmbeddedPostgresTestSupport> | null = null;

function formatEmbeddedPostgresError(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message;
  if (typeof error === "string" && error.length > 0) return error;
  return "embedded Postgres startup failed";
}

export async function getEmbeddedPostgresTestSupport(): Promise<EmbeddedPostgresTestSupport> {
  if (!embeddedPostgresSupportPromise) {
    embeddedPostgresSupportPromise = (async () => {
      const cached = await readCachedEmbeddedPostgresTestSupport();
      return cached?.supported ? cached : await prepareEmbeddedPostgresTestSupport();
    })();
  }
  return await embeddedPostgresSupportPromise;
}

export async function startEmbeddedPostgresTestDatabase(
  tempDirPrefix: string,
): Promise<EmbeddedPostgresTestDatabase> {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), tempDirPrefix));
  const preferredPort = await getAvailablePort();

  try {
    const handle = await startManagedEmbeddedPostgres({
      dataDir,
      preferredPort,
      registerTestInstance: true,
    });

    await ensurePostgresDatabase(handle.adminConnectionString, "paperclip");
    const connectionString = handle.connectionStringFor("paperclip");
    await applyPendingMigrations(connectionString);

    return {
      connectionString,
      cleanup: async () => {
        await handle.stop().catch(() => undefined);
        await removeDataDirWithRetries(dataDir);
      },
    };
  } catch (error) {
    await removeDataDirWithRetries(dataDir).catch(() => undefined);
    throw new Error(
      `Failed to start embedded PostgreSQL test database: ${formatEmbeddedPostgresError(error)}`,
    );
  }
}
