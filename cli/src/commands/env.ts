import * as p from "@clack/prompts";
import pc from "picocolors";
import type { PaperclipConfig } from "../config/schema.js";
import { configExists, readConfig, resolveConfigPath } from "../config/store.js";
import {
  readAgentJwtSecretFromEnv,
  readAgentJwtSecretFromEnvFile,
  resolveAgentJwtEnvFile,
} from "../config/env.js";
import {
  resolveDefaultSecretsKeyFilePath,
  resolveDefaultStorageDir,
  resolveAutomanagerInstanceId,
} from "../config/home.js";

type EnvSource = "env" | "config" | "file" | "default" | "missing";

type EnvVarRow = {
  key: string;
  value: string;
  source: EnvSource;
  required: boolean;
  note: string;
};

const DEFAULT_AGENT_JWT_TTL_SECONDS = "172800";
const DEFAULT_AGENT_JWT_ISSUER = "paperclip";
const DEFAULT_AGENT_JWT_AUDIENCE = "paperclip-api";
const DEFAULT_HEARTBEAT_SCHEDULER_INTERVAL_MS = "30000";
const DEFAULT_SECRETS_PROVIDER = "local_encrypted";
const DEFAULT_STORAGE_PROVIDER = "local_disk";
function defaultSecretsKeyFilePath(): string {
  return resolveDefaultSecretsKeyFilePath(resolveAutomanagerInstanceId());
}
function defaultStorageBaseDir(): string {
  return resolveDefaultStorageDir(resolveAutomanagerInstanceId());
}

export async function envCommand(opts: { config?: string }): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" automanager env ")));

  const configPath = resolveConfigPath(opts.config);
  let config: PaperclipConfig | null = null;
  let configReadError: string | null = null;

  if (configExists(opts.config)) {
    p.log.message(pc.dim(`Config file: ${configPath}`));
    try {
      config = readConfig(opts.config);
    } catch (err) {
      configReadError = err instanceof Error ? err.message : String(err);
      p.log.message(pc.yellow(`설정 파싱 실패: ${configReadError}`));
    }
  } else {
    p.log.message(pc.dim(`설정 파일 없음: ${configPath}`));
  }

  const rows = collectDeploymentEnvRows(config, configPath);
  const missingRequired = rows.filter((row) => row.required && row.source === "missing");
  const sortedRows = rows.sort((a, b) => Number(b.required) - Number(a.required) || a.key.localeCompare(b.key));

  const requiredRows = sortedRows.filter((row) => row.required);
  const optionalRows = sortedRows.filter((row) => !row.required);

  const formatSection = (title: string, entries: EnvVarRow[]) => {
    if (entries.length === 0) return;

    p.log.message(pc.bold(title));
    for (const entry of entries) {
      const status = entry.source === "missing" ? pc.red("없음") : entry.source === "default" ? pc.yellow("기본값") : pc.green("설정됨");
      const sourceNote = {
        env: "환경변수",
        config: "설정파일",
        file: "파일",
        default: "기본값",
        missing: "없음",
      }[entry.source];
      p.log.message(
        `${pc.cyan(entry.key)} ${status.padEnd(7)} ${pc.dim(`[${sourceNote}] ${entry.note}`)}${entry.source === "missing" ? "" : ` ${pc.dim("=>")} ${pc.white(quoteShellValue(entry.value))}`}`,
      );
    }
  };

  formatSection("필수 환경 변수", requiredRows);
  formatSection("선택 환경 변수", optionalRows);

  const exportRows = rows.map((row) => (row.source === "missing" ? { ...row, value: "<set-this-value>" } : row));
  const uniqueRows = uniqueByKey(exportRows);
  const exportBlock = uniqueRows.map((row) => `export ${row.key}=${quoteShellValue(row.value)}`).join("\n");

  if (configReadError) {
    p.log.error(`설정을 올바르게 불러올 수 없습니다: ${configReadError}`);
  }

  p.note(
    exportBlock || "감지된 값이 없습니다. 필수 변수를 수동으로 설정하세요.",
    "배포 export 블록",
  );

  if (missingRequired.length > 0) {
    p.log.message(
      pc.yellow(
        `누락된 필수 값: ${missingRequired.map((row) => row.key).join(", ")}. 배포 전에 설정하세요.`,
      ),
    );
  } else {
    p.log.message(pc.green("모든 필수 배포 변수가 설정되어 있습니다."));
  }
  p.outro("완료");
}

function collectDeploymentEnvRows(config: PaperclipConfig | null, configPath: string): EnvVarRow[] {
  const agentJwtEnvFile = resolveAgentJwtEnvFile(configPath);
  const jwtEnv = readAgentJwtSecretFromEnv(configPath);
  const jwtFile = jwtEnv ? null : readAgentJwtSecretFromEnvFile(agentJwtEnvFile);
  const jwtSource = jwtEnv ? "env" : jwtFile ? "file" : "missing";

  const dbUrl = process.env.DATABASE_URL ?? config?.database?.connectionString ?? "";
  const databaseMode = config?.database?.mode ?? "embedded-postgres";
  const dbUrlSource: EnvSource = process.env.DATABASE_URL ? "env" : config?.database?.connectionString ? "config" : "missing";
  const publicUrl =
    process.env.AUTOMANAGER_PUBLIC_URL ??
    process.env.AUTOMANAGER_AUTH_PUBLIC_BASE_URL ??
    process.env.BETTER_AUTH_URL ??
    process.env.BETTER_AUTH_BASE_URL ??
    config?.auth?.publicBaseUrl ??
    "";
  const publicUrlSource: EnvSource =
    process.env.AUTOMANAGER_PUBLIC_URL
      ? "env"
      : process.env.AUTOMANAGER_AUTH_PUBLIC_BASE_URL || process.env.BETTER_AUTH_URL || process.env.BETTER_AUTH_BASE_URL
        ? "env"
        : config?.auth?.publicBaseUrl
          ? "config"
          : "missing";
  let trustedOriginsDefault = "";
  if (publicUrl) {
    try {
      trustedOriginsDefault = new URL(publicUrl).origin;
    } catch {
      trustedOriginsDefault = "";
    }
  }

  const heartbeatInterval = process.env.HEARTBEAT_SCHEDULER_INTERVAL_MS ?? DEFAULT_HEARTBEAT_SCHEDULER_INTERVAL_MS;
  const heartbeatEnabled = process.env.HEARTBEAT_SCHEDULER_ENABLED ?? "true";
  const secretsProvider =
    process.env.AUTOMANAGER_SECRETS_PROVIDER ??
    config?.secrets?.provider ??
    DEFAULT_SECRETS_PROVIDER;
  const secretsStrictMode =
    process.env.AUTOMANAGER_SECRETS_STRICT_MODE ??
    String(config?.secrets?.strictMode ?? false);
  const secretsKeyFilePath =
    process.env.AUTOMANAGER_SECRETS_MASTER_KEY_FILE ??
    config?.secrets?.localEncrypted?.keyFilePath ??
    defaultSecretsKeyFilePath();
  const storageProvider =
    process.env.AUTOMANAGER_STORAGE_PROVIDER ??
    config?.storage?.provider ??
    DEFAULT_STORAGE_PROVIDER;
  const storageLocalDir =
    process.env.AUTOMANAGER_STORAGE_LOCAL_DIR ??
    config?.storage?.localDisk?.baseDir ??
    defaultStorageBaseDir();
  const storageS3Bucket =
    process.env.AUTOMANAGER_STORAGE_S3_BUCKET ??
    config?.storage?.s3?.bucket ??
    "paperclip";
  const storageS3Region =
    process.env.AUTOMANAGER_STORAGE_S3_REGION ??
    config?.storage?.s3?.region ??
    "us-east-1";
  const storageS3Endpoint =
    process.env.AUTOMANAGER_STORAGE_S3_ENDPOINT ??
    config?.storage?.s3?.endpoint ??
    "";
  const storageS3Prefix =
    process.env.AUTOMANAGER_STORAGE_S3_PREFIX ??
    config?.storage?.s3?.prefix ??
    "";
  const storageS3ForcePathStyle =
    process.env.AUTOMANAGER_STORAGE_S3_FORCE_PATH_STYLE ??
    String(config?.storage?.s3?.forcePathStyle ?? false);

  const rows: EnvVarRow[] = [
    {
      key: "AUTOMANAGER_AGENT_JWT_SECRET",
      value: jwtEnv ?? jwtFile ?? "",
      source: jwtSource,
      required: true,
      note:
        jwtSource === "missing"
          ? "onboard 시 생성하거나 수동으로 설정 (로컬 어댑터 인증에 필요)"
          : jwtSource === "env"
            ? "프로세스 환경에 설정됨"
            : `${agentJwtEnvFile}에 설정됨`,
    },
    {
      key: "DATABASE_URL",
      value: dbUrl,
      source: dbUrlSource,
      required: true,
      note:
        databaseMode === "postgres"
          ? "postgres 모드로 설정됨 (필수)"
          : "관리형 PostgreSQL을 사용한 실서버 배포에 필요",
    },
    {
      key: "PORT",
      value:
        process.env.PORT ??
        (config?.server?.port !== undefined ? String(config.server.port) : "3100"),
      source: process.env.PORT ? "env" : config?.server?.port !== undefined ? "config" : "default",
      required: false,
      note: "HTTP 리슨 포트",
    },
    {
      key: "AUTOMANAGER_PUBLIC_URL",
      value: publicUrl,
      source: publicUrlSource,
      required: false,
      note: "인증/콜백/초대 오리진 연결을 위한 정규 공개 URL",
    },
    {
      key: "BETTER_AUTH_TRUSTED_ORIGINS",
      value: process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? trustedOriginsDefault,
      source: process.env.BETTER_AUTH_TRUSTED_ORIGINS
        ? "env"
        : trustedOriginsDefault
          ? "default"
          : "missing",
      required: false,
      note: "쉼표로 구분된 인증 오리진 허용 목록 (가능한 경우 AUTOMANAGER_PUBLIC_URL에서 자동 파생)",
    },
    {
      key: "AUTOMANAGER_AGENT_JWT_TTL_SECONDS",
      value: process.env.AUTOMANAGER_AGENT_JWT_TTL_SECONDS ?? DEFAULT_AGENT_JWT_TTL_SECONDS,
      source: process.env.AUTOMANAGER_AGENT_JWT_TTL_SECONDS ? "env" : "default",
      required: false,
      note: "JWT 유효 기간 (초)",
    },
    {
      key: "AUTOMANAGER_AGENT_JWT_ISSUER",
      value: process.env.AUTOMANAGER_AGENT_JWT_ISSUER ?? DEFAULT_AGENT_JWT_ISSUER,
      source: process.env.AUTOMANAGER_AGENT_JWT_ISSUER ? "env" : "default",
      required: false,
      note: "JWT 발급자",
    },
    {
      key: "AUTOMANAGER_AGENT_JWT_AUDIENCE",
      value: process.env.AUTOMANAGER_AGENT_JWT_AUDIENCE ?? DEFAULT_AGENT_JWT_AUDIENCE,
      source: process.env.AUTOMANAGER_AGENT_JWT_AUDIENCE ? "env" : "default",
      required: false,
      note: "JWT 대상",
    },
    {
      key: "HEARTBEAT_SCHEDULER_INTERVAL_MS",
      value: heartbeatInterval,
      source: process.env.HEARTBEAT_SCHEDULER_INTERVAL_MS ? "env" : "default",
      required: false,
      note: "하트비트 워커 간격 (ms)",
    },
    {
      key: "HEARTBEAT_SCHEDULER_ENABLED",
      value: heartbeatEnabled,
      source: process.env.HEARTBEAT_SCHEDULER_ENABLED ? "env" : "default",
      required: false,
      note: "타이머 스케줄링을 비활성화하려면 `false`로 설정",
    },
    {
      key: "AUTOMANAGER_SECRETS_PROVIDER",
      value: secretsProvider,
      source: process.env.AUTOMANAGER_SECRETS_PROVIDER
        ? "env"
        : config?.secrets?.provider
          ? "config"
          : "default",
      required: false,
      note: "새 시크릿의 기본 제공자",
    },
    {
      key: "AUTOMANAGER_SECRETS_STRICT_MODE",
      value: secretsStrictMode,
      source: process.env.AUTOMANAGER_SECRETS_STRICT_MODE
        ? "env"
        : config?.secrets?.strictMode !== undefined
          ? "config"
          : "default",
      required: false,
      note: "민감한 환경 키에 시크릿 참조 필수 여부",
    },
    {
      key: "AUTOMANAGER_SECRETS_MASTER_KEY_FILE",
      value: secretsKeyFilePath,
      source: process.env.AUTOMANAGER_SECRETS_MASTER_KEY_FILE
        ? "env"
        : config?.secrets?.localEncrypted?.keyFilePath
          ? "config"
          : "default",
      required: false,
      note: "로컬 암호화 시크릿 키 파일 경로",
    },
    {
      key: "AUTOMANAGER_STORAGE_PROVIDER",
      value: storageProvider,
      source: process.env.AUTOMANAGER_STORAGE_PROVIDER
        ? "env"
        : config?.storage?.provider
          ? "config"
          : "default",
      required: false,
      note: "스토리지 제공자 (local_disk 또는 s3)",
    },
    {
      key: "AUTOMANAGER_STORAGE_LOCAL_DIR",
      value: storageLocalDir,
      source: process.env.AUTOMANAGER_STORAGE_LOCAL_DIR
        ? "env"
        : config?.storage?.localDisk?.baseDir
          ? "config"
          : "default",
      required: false,
      note: "local_disk 제공자의 로컬 스토리지 기본 디렉터리",
    },
    {
      key: "AUTOMANAGER_STORAGE_S3_BUCKET",
      value: storageS3Bucket,
      source: process.env.AUTOMANAGER_STORAGE_S3_BUCKET
        ? "env"
        : config?.storage?.s3?.bucket
          ? "config"
          : "default",
      required: false,
      note: "s3 제공자의 S3 버킷 이름",
    },
    {
      key: "AUTOMANAGER_STORAGE_S3_REGION",
      value: storageS3Region,
      source: process.env.AUTOMANAGER_STORAGE_S3_REGION
        ? "env"
        : config?.storage?.s3?.region
          ? "config"
          : "default",
      required: false,
      note: "s3 제공자의 S3 리전",
    },
    {
      key: "AUTOMANAGER_STORAGE_S3_ENDPOINT",
      value: storageS3Endpoint,
      source: process.env.AUTOMANAGER_STORAGE_S3_ENDPOINT
        ? "env"
        : config?.storage?.s3?.endpoint
          ? "config"
          : "default",
      required: false,
      note: "S3 호환 제공자를 위한 선택적 커스텀 엔드포인트",
    },
    {
      key: "AUTOMANAGER_STORAGE_S3_PREFIX",
      value: storageS3Prefix,
      source: process.env.AUTOMANAGER_STORAGE_S3_PREFIX
        ? "env"
        : config?.storage?.s3?.prefix
          ? "config"
          : "default",
      required: false,
      note: "선택적 객체 키 접두사",
    },
    {
      key: "AUTOMANAGER_STORAGE_S3_FORCE_PATH_STYLE",
      value: storageS3ForcePathStyle,
      source: process.env.AUTOMANAGER_STORAGE_S3_FORCE_PATH_STYLE
        ? "env"
        : config?.storage?.s3?.forcePathStyle !== undefined
          ? "config"
          : "default",
      required: false,
      note: "호환 제공자에서 경로 스타일 접근을 사용하려면 true로 설정",
    },
  ];

  const defaultConfigPath = resolveConfigPath();
  if (process.env.AUTOMANAGER_CONFIG || configPath !== defaultConfigPath) {
    rows.push({
      key: "AUTOMANAGER_CONFIG",
      value: process.env.AUTOMANAGER_CONFIG ?? configPath,
      source: process.env.AUTOMANAGER_CONFIG ? "env" : "default",
      required: false,
      note: "설정 파일의 선택적 경로 재정의",
    });
  }

  return rows;
}

function uniqueByKey(rows: EnvVarRow[]): EnvVarRow[] {
  const seen = new Set<string>();
  const result: EnvVarRow[] = [];
  for (const row of rows) {
    if (seen.has(row.key)) continue;
    seen.add(row.key);
    result.push(row);
  }
  return result;
}

function quoteShellValue(value: string): string {
  if (value === "") return "\"\"";
  return `'${value.replaceAll("'", "'\\''")}'`;
}
