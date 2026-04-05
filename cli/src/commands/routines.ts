import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import {
  applyPendingMigrations,
  createDb,
  ensurePostgresDatabase,
  formatEmbeddedPostgresError,
  routines,
} from "@penclipai/db";
import { startManagedEmbeddedPostgres } from "@penclipai/db/embedded-postgres-manager";
import { eq, inArray } from "drizzle-orm";
import { loadPaperclipEnvFile } from "../config/env.js";
import { readConfig, resolveConfigPath } from "../config/store.js";

type RoutinesDisableAllOptions = {
  config?: string;
  dataDir?: string;
  companyId?: string;
  json?: boolean;
};

type DisableAllRoutinesResult = {
  companyId: string;
  totalRoutines: number;
  pausedCount: number;
  alreadyPausedCount: number;
  archivedCount: number;
};

type EmbeddedPostgresHandle = {
  port: number;
  startedByThisProcess: boolean;
  stop: () => Promise<void>;
};

type ClosableDb = ReturnType<typeof createDb> & {
  $client?: {
    end?: (options?: { timeout?: number }) => Promise<void>;
  };
};

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function ensureEmbeddedPostgres(dataDir: string, preferredPort: number): Promise<EmbeddedPostgresHandle> {
  const handle = await startManagedEmbeddedPostgres({
    dataDir,
    formatStartupError: ({ dataDir: currentDataDir, error, phase, port, recentLogs }) =>
      formatEmbeddedPostgresError(error, {
        fallbackMessage:
          phase === "initialise"
            ? `Failed to initialize embedded PostgreSQL cluster in ${currentDataDir} on port ${port}`
            : `Failed to start embedded PostgreSQL on port ${port}`,
        recentLogs,
      }),
    preferredPort,
  });
  return {
    port: handle.port,
    startedByThisProcess: handle.startedByThisProcess,
    stop: handle.stop,
  };
}

async function closeDb(db: ClosableDb): Promise<void> {
  await db.$client?.end?.({ timeout: 5 }).catch(() => undefined);
}

async function openConfiguredDb(configPath: string): Promise<{
  db: ClosableDb;
  stop: () => Promise<void>;
}> {
  const config = readConfig(configPath);
  if (!config) {
    throw new Error(`Config not found at ${configPath}.`);
  }

  let embeddedHandle: EmbeddedPostgresHandle | null = null;
  try {
    if (config.database.mode === "embedded-postgres") {
      embeddedHandle = await ensureEmbeddedPostgres(
        config.database.embeddedPostgresDataDir,
        config.database.embeddedPostgresPort,
      );
      const adminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${embeddedHandle.port}/postgres`;
      await ensurePostgresDatabase(adminConnectionString, "paperclip");
      const connectionString = `postgres://paperclip:paperclip@127.0.0.1:${embeddedHandle.port}/paperclip`;
      await applyPendingMigrations(connectionString);
      const db = createDb(connectionString) as ClosableDb;
      return {
        db,
        stop: async () => {
          await closeDb(db);
          if (embeddedHandle?.startedByThisProcess) {
            await embeddedHandle.stop().catch(() => undefined);
          }
        },
      };
    }

    const connectionString = nonEmpty(config.database.connectionString);
    if (!connectionString) {
      throw new Error(`Config at ${configPath} does not define a database connection string.`);
    }

    await applyPendingMigrations(connectionString);
    const db = createDb(connectionString) as ClosableDb;
    return {
      db,
      stop: async () => {
        await closeDb(db);
      },
    };
  } catch (error) {
    if (embeddedHandle?.startedByThisProcess) {
      await embeddedHandle.stop().catch(() => undefined);
    }
    throw error;
  }
}

export async function disableAllRoutinesInConfig(
  options: Pick<RoutinesDisableAllOptions, "config" | "companyId">,
): Promise<DisableAllRoutinesResult> {
  const configPath = resolveConfigPath(options.config);
  loadPaperclipEnvFile(configPath);
  const companyId =
    nonEmpty(options.companyId)
    ?? nonEmpty(process.env.PAPERCLIP_COMPANY_ID)
    ?? null;
  if (!companyId) {
    throw new Error("Company ID is required. Pass --company-id or set PAPERCLIP_COMPANY_ID.");
  }

  const config = readConfig(configPath);
  if (!config) {
    throw new Error(`Config not found at ${configPath}.`);
  }

  let embeddedHandle: EmbeddedPostgresHandle | null = null;
  let db: ClosableDb | null = null;
  try {
    if (config.database.mode === "embedded-postgres") {
      embeddedHandle = await ensureEmbeddedPostgres(
        config.database.embeddedPostgresDataDir,
        config.database.embeddedPostgresPort,
      );
      const adminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${embeddedHandle.port}/postgres`;
      await ensurePostgresDatabase(adminConnectionString, "paperclip");
      const connectionString = `postgres://paperclip:paperclip@127.0.0.1:${embeddedHandle.port}/paperclip`;
      await applyPendingMigrations(connectionString);
      db = createDb(connectionString) as ClosableDb;
    } else {
      const connectionString = nonEmpty(config.database.connectionString);
      if (!connectionString) {
        throw new Error(`Config at ${configPath} does not define a database connection string.`);
      }
      await applyPendingMigrations(connectionString);
      db = createDb(connectionString) as ClosableDb;
    }

    const existing = await db
      .select({
        id: routines.id,
        status: routines.status,
      })
      .from(routines)
      .where(eq(routines.companyId, companyId));

    const alreadyPausedCount = existing.filter((routine) => routine.status === "paused").length;
    const archivedCount = existing.filter((routine) => routine.status === "archived").length;
    const idsToPause = existing
      .filter((routine) => routine.status !== "paused" && routine.status !== "archived")
      .map((routine) => routine.id);

    if (idsToPause.length > 0) {
      await db
        .update(routines)
        .set({
          status: "paused",
          updatedAt: new Date(),
        })
        .where(inArray(routines.id, idsToPause));
    }

    return {
      companyId,
      totalRoutines: existing.length,
      pausedCount: idsToPause.length,
      alreadyPausedCount,
      archivedCount,
    };
  } finally {
    if (db) {
      await closeDb(db);
    }
    if (embeddedHandle?.startedByThisProcess) {
      await embeddedHandle.stop().catch(() => undefined);
    }
  }
}

export async function disableAllRoutinesCommand(options: RoutinesDisableAllOptions): Promise<void> {
  const result = await disableAllRoutinesInConfig(options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.totalRoutines === 0) {
    console.log(pc.dim(`No routines found for company ${result.companyId}.`));
    return;
  }

  console.log(
    `Paused ${result.pausedCount} routine(s) for company ${result.companyId} ` +
      `(${result.alreadyPausedCount} already paused, ${result.archivedCount} archived).`,
  );
}

export function registerRoutineCommands(program: Command): void {
  const routinesCommand = program.command("routines").description("Local routine maintenance commands");

  routinesCommand
    .command("disable-all")
    .description("Pause all non-archived routines in the configured local instance for one company")
    .option("-c, --config <path>", "Path to config file")
    .option("-d, --data-dir <path>", "Paperclip data directory root (isolates state from ~/.paperclip)")
    .option("-C, --company-id <id>", "Company ID")
    .option("--json", "Output raw JSON")
    .action(async (opts: RoutinesDisableAllOptions) => {
      try {
        await disableAllRoutinesCommand(opts);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(pc.red(message));
        process.exit(1);
      }
    });
}
