import {
  ensurePostgresDatabase,
} from "./client.js";
import { formatEmbeddedPostgresError } from "./embedded-postgres-error.js";
import {
  startManagedEmbeddedPostgres,
} from "./embedded-postgres-manager.js";
import { resolveDatabaseTarget } from "./runtime-config.js";

export type MigrationConnection = {
  connectionString: string;
  source: string;
  stop: () => Promise<void>;
};

async function ensureEmbeddedPostgresConnection(
  dataDir: string,
  preferredPort: number,
): Promise<MigrationConnection> {
  const handle = await startManagedEmbeddedPostgres({
    dataDir,
    ensureDatabaseName: "paperclip",
    formatStartupError: ({ dataDir: currentDataDir, error, phase, port, recentLogs }) =>
      formatEmbeddedPostgresError(error, {
        fallbackMessage:
          phase === "initialise"
            ? `Failed to initialize embedded PostgreSQL cluster in ${currentDataDir} on port ${port}`
            : `Failed to start embedded PostgreSQL on port ${port}`,
        recentLogs,
      }),
    logger: {
      warn: (message) => {
        process.emitWarning(message);
      },
    },
    preferredPort,
  });

  await ensurePostgresDatabase(handle.adminConnectionString, "paperclip");

  return {
    connectionString: handle.connectionStringFor("paperclip"),
    source: `embedded-postgres@${handle.port}`,
    stop: async () => {
      await handle.stop();
    },
  };
}

export async function resolveMigrationConnection(): Promise<MigrationConnection> {
  const target = resolveDatabaseTarget();
  if (target.mode === "postgres") {
    return {
      connectionString: target.connectionString,
      source: target.source,
      stop: async () => {},
    };
  }

  return await ensureEmbeddedPostgresConnection(target.dataDir, target.port);
}
