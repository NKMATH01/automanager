import path from "node:path";
import {
  expandHomePrefix,
  resolveDefaultConfigPath,
  resolveDefaultContextPath,
  resolveAutomanagerInstanceId,
} from "./home.js";

export interface DataDirOptionLike {
  dataDir?: string;
  config?: string;
  context?: string;
  instance?: string;
}

export interface DataDirCommandSupport {
  hasConfigOption?: boolean;
  hasContextOption?: boolean;
}

export function applyDataDirOverride(
  options: DataDirOptionLike,
  support: DataDirCommandSupport = {},
): string | null {
  const rawDataDir = options.dataDir?.trim();
  if (!rawDataDir) return null;

  const resolvedDataDir = path.resolve(expandHomePrefix(rawDataDir));
  process.env.AUTOMANAGER_HOME = resolvedDataDir;

  if (support.hasConfigOption) {
    const hasConfigOverride = Boolean(options.config?.trim()) || Boolean(process.env.AUTOMANAGER_CONFIG?.trim());
    if (!hasConfigOverride) {
      const instanceId = resolveAutomanagerInstanceId(options.instance);
      process.env.AUTOMANAGER_INSTANCE_ID = instanceId;
      process.env.AUTOMANAGER_CONFIG = resolveDefaultConfigPath(instanceId);
    }
  }

  if (support.hasContextOption) {
    const hasContextOverride = Boolean(options.context?.trim()) || Boolean(process.env.AUTOMANAGER_CONTEXT?.trim());
    if (!hasContextOverride) {
      process.env.AUTOMANAGER_CONTEXT = resolveDefaultContextPath();
    }
  }

  return resolvedDataDir;
}
