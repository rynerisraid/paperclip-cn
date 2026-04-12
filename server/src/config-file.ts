import fs from "node:fs";
import {
  normalizeLegacyDesktopStoragePath,
  resolveDefaultBackupDir,
  resolveDefaultEmbeddedPostgresDir,
  resolveDefaultLogsDir,
  resolveDefaultSecretsKeyFilePath,
  resolveDefaultStorageDir,
  resolveHomeAwarePath,
} from "./home-paths.js";
import { paperclipConfigSchema, type PaperclipConfig } from "@penclipai/shared";
import { resolvePaperclipConfigPath } from "./paths.js";

const DESKTOP_TEMP_INSTANCE_PATH_RE = /paperclip-desktop-(?:smoke|acceptance)-/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isBrokenDesktopTempPath(value: unknown): boolean {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  const resolved = resolveHomeAwarePath(value);
  return DESKTOP_TEMP_INSTANCE_PATH_RE.test(resolved) && !fs.existsSync(resolved);
}

function repairBrokenDesktopTempPaths(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return raw;
  }

  const next = structuredClone(raw as Record<string, unknown>);
  const database = asRecord(next.database);
  const logging = asRecord(next.logging);
  const storage = asRecord(next.storage);
  const storageLocalDisk = asRecord(storage?.localDisk);
  const secrets = asRecord(next.secrets);
  const localEncrypted = asRecord(secrets?.localEncrypted);
  const backup = asRecord(database?.backup);

  if (database && isBrokenDesktopTempPath(database.embeddedPostgresDataDir)) {
    database.embeddedPostgresDataDir = resolveDefaultEmbeddedPostgresDir();
  }
  if (backup && isBrokenDesktopTempPath(backup.dir)) {
    backup.dir = resolveDefaultBackupDir();
  }
  if (logging && isBrokenDesktopTempPath(logging.logDir)) {
    logging.logDir = resolveDefaultLogsDir();
  }
  if (storageLocalDisk && isBrokenDesktopTempPath(storageLocalDisk.baseDir)) {
    storageLocalDisk.baseDir = resolveDefaultStorageDir();
  }
  if (localEncrypted && isBrokenDesktopTempPath(localEncrypted.keyFilePath)) {
    localEncrypted.keyFilePath = resolveDefaultSecretsKeyFilePath();
  }

  return next;
}

function repairLegacyDesktopStoragePaths(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return raw;
  }

  const next = structuredClone(raw as Record<string, unknown>);
  const database = asRecord(next.database);
  const logging = asRecord(next.logging);
  const storage = asRecord(next.storage);
  const storageLocalDisk = asRecord(storage?.localDisk);
  const secrets = asRecord(next.secrets);
  const localEncrypted = asRecord(secrets?.localEncrypted);
  const backup = asRecord(database?.backup);

  if (database && typeof database.embeddedPostgresDataDir === "string") {
    database.embeddedPostgresDataDir = normalizeLegacyDesktopStoragePath(database.embeddedPostgresDataDir);
  }
  if (backup && typeof backup.dir === "string") {
    backup.dir = normalizeLegacyDesktopStoragePath(backup.dir);
  }
  if (logging && typeof logging.logDir === "string") {
    logging.logDir = normalizeLegacyDesktopStoragePath(logging.logDir);
  }
  if (storageLocalDisk && typeof storageLocalDisk.baseDir === "string") {
    storageLocalDisk.baseDir = normalizeLegacyDesktopStoragePath(storageLocalDisk.baseDir);
  }
  if (localEncrypted && typeof localEncrypted.keyFilePath === "string") {
    localEncrypted.keyFilePath = normalizeLegacyDesktopStoragePath(localEncrypted.keyFilePath);
  }

  return next;
}

export function readConfigFile(): PaperclipConfig | null {
  const configPath = resolvePaperclipConfigPath();

  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return paperclipConfigSchema.parse(repairBrokenDesktopTempPaths(repairLegacyDesktopStoragePaths(raw)));
  } catch {
    return null;
  }
}
