import fs from "node:fs";
import path from "node:path";
import { paperclipConfigSchema, type PaperclipConfig } from "./schema.js";
import {
  normalizeLegacyDesktopStoragePath,
  resolveDefaultConfigPath,
  resolvePaperclipInstanceId,
} from "./home.js";

const DEFAULT_CONFIG_BASENAME = "config.json";

function findConfigFileFromAncestors(startDir: string): string | null {
  const absoluteStartDir = path.resolve(startDir);
  let currentDir = absoluteStartDir;

  while (true) {
    const candidate = path.resolve(currentDir, ".paperclip", DEFAULT_CONFIG_BASENAME);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const nextDir = path.resolve(currentDir, "..");
    if (nextDir === currentDir) break;
    currentDir = nextDir;
  }

  return null;
}

export function resolveConfigPath(overridePath?: string): string {
  if (overridePath) return path.resolve(overridePath);
  if (process.env.PAPERCLIP_CONFIG) return path.resolve(process.env.PAPERCLIP_CONFIG);
  return findConfigFileFromAncestors(process.cwd()) ?? resolveDefaultConfigPath(resolvePaperclipInstanceId());
}

function parseJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    throw new Error(`Failed to parse JSON at ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function migrateLegacyConfig(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  const config = { ...(raw as Record<string, unknown>) };
  const databaseRaw = config.database;
  if (typeof databaseRaw !== "object" || databaseRaw === null || Array.isArray(databaseRaw)) {
    return config;
  }

  const database = { ...(databaseRaw as Record<string, unknown>) };
  if (database.mode === "pglite") {
    database.mode = "embedded-postgres";

    if (typeof database.embeddedPostgresDataDir !== "string" && typeof database.pgliteDataDir === "string") {
      database.embeddedPostgresDataDir = database.pgliteDataDir;
    }
    if (
      typeof database.embeddedPostgresPort !== "number" &&
      typeof database.pglitePort === "number" &&
      Number.isFinite(database.pglitePort)
    ) {
      database.embeddedPostgresPort = database.pglitePort;
    }
  }

  config.database = database;
  if (typeof database.embeddedPostgresDataDir === "string") {
    database.embeddedPostgresDataDir = normalizeLegacyDesktopStoragePath(database.embeddedPostgresDataDir);
  }
  if (typeof database.backup === "object" && database.backup !== null && !Array.isArray(database.backup)) {
    const backup = { ...(database.backup as Record<string, unknown>) };
    if (typeof backup.dir === "string") {
      backup.dir = normalizeLegacyDesktopStoragePath(backup.dir);
    }
    database.backup = backup;
  }

  const logging = config.logging;
  if (typeof logging === "object" && logging !== null && !Array.isArray(logging)) {
    const nextLogging = { ...(logging as Record<string, unknown>) };
    if (typeof nextLogging.logDir === "string") {
      nextLogging.logDir = normalizeLegacyDesktopStoragePath(nextLogging.logDir);
    }
    config.logging = nextLogging;
  }

  const storage = config.storage;
  if (typeof storage === "object" && storage !== null && !Array.isArray(storage)) {
    const nextStorage = { ...(storage as Record<string, unknown>) };
    const localDisk = nextStorage.localDisk;
    if (typeof localDisk === "object" && localDisk !== null && !Array.isArray(localDisk)) {
      const nextLocalDisk = { ...(localDisk as Record<string, unknown>) };
      if (typeof nextLocalDisk.baseDir === "string") {
        nextLocalDisk.baseDir = normalizeLegacyDesktopStoragePath(nextLocalDisk.baseDir);
      }
      nextStorage.localDisk = nextLocalDisk;
    }
    config.storage = nextStorage;
  }

  const secrets = config.secrets;
  if (typeof secrets === "object" && secrets !== null && !Array.isArray(secrets)) {
    const nextSecrets = { ...(secrets as Record<string, unknown>) };
    const localEncrypted = nextSecrets.localEncrypted;
    if (typeof localEncrypted === "object" && localEncrypted !== null && !Array.isArray(localEncrypted)) {
      const nextLocalEncrypted = { ...(localEncrypted as Record<string, unknown>) };
      if (typeof nextLocalEncrypted.keyFilePath === "string") {
        nextLocalEncrypted.keyFilePath = normalizeLegacyDesktopStoragePath(nextLocalEncrypted.keyFilePath);
      }
      nextSecrets.localEncrypted = nextLocalEncrypted;
    }
    config.secrets = nextSecrets;
  }
  return config;
}

function formatValidationError(err: unknown): string {
  const issues = (err as { issues?: Array<{ path?: unknown; message?: unknown }> })?.issues;
  if (Array.isArray(issues) && issues.length > 0) {
    return issues
      .map((issue) => {
        const pathParts = Array.isArray(issue.path) ? issue.path.map(String) : [];
        const issuePath = pathParts.length > 0 ? pathParts.join(".") : "config";
        const message = typeof issue.message === "string" ? issue.message : "Invalid value";
        return `${issuePath}: ${message}`;
      })
      .join("; ");
  }
  return err instanceof Error ? err.message : String(err);
}

export function readConfig(configPath?: string): PaperclipConfig | null {
  const filePath = resolveConfigPath(configPath);
  if (!fs.existsSync(filePath)) return null;
  const raw = parseJson(filePath);
  const migrated = migrateLegacyConfig(raw);
  const parsed = paperclipConfigSchema.safeParse(migrated);
  if (!parsed.success) {
    throw new Error(`Invalid config at ${filePath}: ${formatValidationError(parsed.error)}`);
  }
  return parsed.data;
}

export function writeConfig(
  config: PaperclipConfig,
  configPath?: string,
): void {
  const filePath = resolveConfigPath(configPath);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  // Backup existing config before overwriting
  if (fs.existsSync(filePath)) {
    const backupPath = filePath + ".backup";
    fs.copyFileSync(filePath, backupPath);
    fs.chmodSync(backupPath, 0o600);
  }

  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
}

export function configExists(configPath?: string): boolean {
  return fs.existsSync(resolveConfigPath(configPath));
}
