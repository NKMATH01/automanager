import os from "node:os";
import path from "node:path";

const DEFAULT_INSTANCE_ID = "default";
const INSTANCE_ID_RE = /^[a-zA-Z0-9_-]+$/;

export function resolveAutomanagerHomeDir(): string {
  const envHome = process.env.AUTOMANAGER_HOME?.trim();
  if (envHome) return path.resolve(expandHomePrefix(envHome));
  return path.resolve(os.homedir(), ".automanager");
}

export function resolveAutomanagerInstanceId(override?: string): string {
  const raw = override?.trim() || process.env.AUTOMANAGER_INSTANCE_ID?.trim() || DEFAULT_INSTANCE_ID;
  if (!INSTANCE_ID_RE.test(raw)) {
    throw new Error(
      `Invalid instance id '${raw}'. Allowed characters: letters, numbers, '_' and '-'.`,
    );
  }
  return raw;
}

export function resolveAutomanagerInstanceRoot(instanceId?: string): string {
  const id = resolveAutomanagerInstanceId(instanceId);
  return path.resolve(resolveAutomanagerHomeDir(), "instances", id);
}

export function resolveDefaultConfigPath(instanceId?: string): string {
  return path.resolve(resolveAutomanagerInstanceRoot(instanceId), "config.json");
}

export function resolveDefaultContextPath(): string {
  return path.resolve(resolveAutomanagerHomeDir(), "context.json");
}

export function resolveDefaultCliAuthPath(): string {
  return path.resolve(resolveAutomanagerHomeDir(), "auth.json");
}

export function resolveDefaultEmbeddedPostgresDir(instanceId?: string): string {
  return path.resolve(resolveAutomanagerInstanceRoot(instanceId), "db");
}

export function resolveDefaultLogsDir(instanceId?: string): string {
  return path.resolve(resolveAutomanagerInstanceRoot(instanceId), "logs");
}

export function resolveDefaultSecretsKeyFilePath(instanceId?: string): string {
  return path.resolve(resolveAutomanagerInstanceRoot(instanceId), "secrets", "master.key");
}

export function resolveDefaultStorageDir(instanceId?: string): string {
  return path.resolve(resolveAutomanagerInstanceRoot(instanceId), "data", "storage");
}

export function resolveDefaultBackupDir(instanceId?: string): string {
  return path.resolve(resolveAutomanagerInstanceRoot(instanceId), "data", "backups");
}

export function expandHomePrefix(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.resolve(os.homedir(), value.slice(2));
  return value;
}

export function describeLocalInstancePaths(instanceId?: string) {
  const resolvedInstanceId = resolveAutomanagerInstanceId(instanceId);
  const instanceRoot = resolveAutomanagerInstanceRoot(resolvedInstanceId);
  return {
    homeDir: resolveAutomanagerHomeDir(),
    instanceId: resolvedInstanceId,
    instanceRoot,
    configPath: resolveDefaultConfigPath(resolvedInstanceId),
    embeddedPostgresDataDir: resolveDefaultEmbeddedPostgresDir(resolvedInstanceId),
    backupDir: resolveDefaultBackupDir(resolvedInstanceId),
    logDir: resolveDefaultLogsDir(resolvedInstanceId),
    secretsKeyFilePath: resolveDefaultSecretsKeyFilePath(resolvedInstanceId),
    storageDir: resolveDefaultStorageDir(resolvedInstanceId),
  };
}
