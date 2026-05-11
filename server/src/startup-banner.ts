import { existsSync, readFileSync } from "node:fs";
import { resolveAutomanagerConfigPath, resolveAutomanagerEnvPath } from "./paths.js";
import type { DeploymentExposure, DeploymentMode } from "@automanager/shared";

import { parse as parseEnvFileContents } from "dotenv";

type UiMode = "none" | "static" | "vite-dev";

type ExternalPostgresInfo = {
  mode: "external-postgres";
  connectionString: string;
};

type EmbeddedPostgresInfo = {
  mode: "embedded-postgres";
  dataDir: string;
  port: number;
};

type StartupBannerOptions = {
  host: string;
  deploymentMode: DeploymentMode;
  deploymentExposure: DeploymentExposure;
  authReady: boolean;
  requestedPort: number;
  listenPort: number;
  uiMode: UiMode;
  db: ExternalPostgresInfo | EmbeddedPostgresInfo;
  migrationSummary: string;
  heartbeatSchedulerEnabled: boolean;
  heartbeatSchedulerIntervalMs: number;
  databaseBackupEnabled: boolean;
  databaseBackupIntervalMinutes: number;
  databaseBackupRetentionDays: number;
  databaseBackupDir: string;
};

const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

function color(text: string, c: keyof typeof ansi): string {
  return `${ansi[c]}${text}${ansi.reset}`;
}

function row(label: string, value: string): string {
  return `${color(label.padEnd(16), "dim")} ${value}`;
}

function redactConnectionString(raw: string): string {
  try {
    const u = new URL(raw);
    const user = u.username || "user";
    const auth = `${user}:***@`;
    return `${u.protocol}//${auth}${u.host}${u.pathname}`;
  } catch {
    return "<invalid DATABASE_URL>";
  }
}

function resolveAgentJwtSecretStatus(
  envFilePath: string,
): {
  status: "pass" | "warn";
  message: string;
} {
  const envValue = process.env.AUTOMANAGER_AGENT_JWT_SECRET?.trim();
  if (envValue) {
    return {
      status: "pass",
      message: "설정됨",
    };
  }

  if (existsSync(envFilePath)) {
    const parsed = parseEnvFileContents(readFileSync(envFilePath, "utf-8"));
    const fileValue = typeof parsed.AUTOMANAGER_AGENT_JWT_SECRET === "string" ? parsed.AUTOMANAGER_AGENT_JWT_SECRET.trim() : "";
    if (fileValue) {
      return {
        status: "warn",
        message: `${envFilePath}에서 발견되었으나 로드되지 않음`,
      };
    }
  }

  return {
    status: "warn",
    message: "미설정 (`pnpm automanager onboard` 실행 필요)",
  };
}

export function printStartupBanner(opts: StartupBannerOptions): void {
  const baseHost = opts.host === "0.0.0.0" ? "localhost" : opts.host;
  const baseUrl = `http://${baseHost}:${opts.listenPort}`;
  const apiUrl = `${baseUrl}/api`;
  const uiUrl = opts.uiMode === "none" ? "비활성" : baseUrl;
  const configPath = resolveAutomanagerConfigPath();
  const envFilePath = resolveAutomanagerEnvPath();
  const agentJwtSecret = resolveAgentJwtSecretStatus(envFilePath);

  const dbMode =
    opts.db.mode === "embedded-postgres"
      ? color("embedded-postgres", "green")
      : color("external-postgres", "yellow");
  const uiMode =
    opts.uiMode === "vite-dev"
      ? color("vite-dev-middleware", "cyan")
      : opts.uiMode === "static"
        ? color("static-ui", "magenta")
        : color("headless-api", "yellow");

  const portValue =
    opts.requestedPort === opts.listenPort
      ? `${opts.listenPort}`
      : `${opts.listenPort} ${color(`(요청: ${opts.requestedPort})`, "dim")}`;

  const dbDetails =
    opts.db.mode === "embedded-postgres"
      ? `${opts.db.dataDir} ${color(`(pg:${opts.db.port})`, "dim")}`
      : redactConnectionString(opts.db.connectionString);

  const heartbeat = opts.heartbeatSchedulerEnabled
    ? `활성 ${color(`(${opts.heartbeatSchedulerIntervalMs}ms)`, "dim")}`
    : color("비활성", "yellow");
  const dbBackup = opts.databaseBackupEnabled
    ? `활성 ${color(`(${opts.databaseBackupIntervalMinutes}분마다, ${opts.databaseBackupRetentionDays}일 보관)`, "dim")}`
    : color("비활성", "yellow");

  const art = [
    color("╔══════════════════════════════════════════╗", "cyan"),
    color("║        오토매니저 (AutoManager)          ║", "cyan"),
    color("║   AI 에이전트 오케스트레이션 플랫폼      ║", "cyan"),
    color("╚══════════════════════════════════════════╝", "cyan"),
  ];

  const lines = [
    "",
    ...art,
    color("  ───────────────────────────────────────────────────────", "blue"),
    row("모드", `${dbMode}  |  ${uiMode}`),
    row("배포", `${opts.deploymentMode} (${opts.deploymentExposure})`),
    row("인증", opts.authReady ? color("준비됨", "green") : color("미준비", "yellow")),
    row("서버", portValue),
    row("API", `${apiUrl} ${color(`(health: ${apiUrl}/health)`, "dim")}`),
    row("UI", uiUrl),
    row("데이터베이스", dbDetails),
    row("마이그레이션", opts.migrationSummary),
    row(
      "에이전트 JWT",
      agentJwtSecret.status === "pass"
        ? color(agentJwtSecret.message, "green")
        : color(agentJwtSecret.message, "yellow"),
    ),
    row("하트비트", heartbeat),
    row("DB 백업", dbBackup),
    row("백업 경로", opts.databaseBackupDir),
    row("설정 파일", configPath),
    agentJwtSecret.status === "warn"
      ? color("  ───────────────────────────────────────────────────────", "yellow")
      : null,
    color("  ───────────────────────────────────────────────────────", "blue"),
    "",
  ];

  console.log(lines.filter((line): line is string => line !== null).join("\n"));
}
