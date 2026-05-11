import { Command } from "commander";
import pc from "picocolors";
import {
  readContext,
  resolveContextPath,
  resolveProfile,
  setCurrentProfile,
  upsertProfile,
} from "../../client/context.js";
import { printOutput } from "./common.js";

interface ContextOptions {
  dataDir?: string;
  context?: string;
  profile?: string;
  json?: boolean;
}

interface ContextSetOptions extends ContextOptions {
  apiBase?: string;
  companyId?: string;
  apiKeyEnvVarName?: string;
  use?: boolean;
}

export function registerContextCommands(program: Command): void {
  const context = program.command("context").description("CLI 클라이언트 컨텍스트 프로필 관리");

  context
    .command("show")
    .description("현재 컨텍스트 및 활성 프로필 표시")
    .option("-d, --data-dir <path>", "오토매니저 데이터 디렉터리 루트 (~/.automanager와 상태를 분리합니다)")
    .option("--context <path>", "Path to CLI context file")
    .option("--profile <name>", "Profile to inspect")
    .option("--json", "Output raw JSON")
    .action((opts: ContextOptions) => {
      const contextPath = resolveContextPath(opts.context);
      const store = readContext(opts.context);
      const resolved = resolveProfile(store, opts.profile);
      const payload = {
        contextPath,
        currentProfile: store.currentProfile,
        profileName: resolved.name,
        profile: resolved.profile,
        profiles: store.profiles,
      };
      printOutput(payload, { json: opts.json });
    });

  context
    .command("list")
    .description("사용 가능한 컨텍스트 프로필 목록")
    .option("-d, --data-dir <path>", "오토매니저 데이터 디렉터리 루트 (~/.automanager와 상태를 분리합니다)")
    .option("--context <path>", "Path to CLI context file")
    .option("--json", "Output raw JSON")
    .action((opts: ContextOptions) => {
      const store = readContext(opts.context);
      const rows = Object.entries(store.profiles).map(([name, profile]) => ({
        name,
        current: name === store.currentProfile,
        apiBase: profile.apiBase ?? null,
        companyId: profile.companyId ?? null,
        apiKeyEnvVarName: profile.apiKeyEnvVarName ?? null,
      }));
      printOutput(rows, { json: opts.json });
    });

  context
    .command("use")
    .description("활성 컨텍스트 프로필 설정")
    .argument("<profile>", "프로필 이름")
    .option("-d, --data-dir <path>", "오토매니저 데이터 디렉터리 루트 (~/.automanager와 상태를 분리합니다)")
    .option("--context <path>", "Path to CLI context file")
    .action((profile: string, opts: ContextOptions) => {
      setCurrentProfile(profile, opts.context);
      console.log(pc.green(`활성 프로필이 '${profile}'로 설정되었습니다.`));
    });

  context
    .command("set")
    .description("프로필 값 설정")
    .option("-d, --data-dir <path>", "오토매니저 데이터 디렉터리 루트 (~/.automanager와 상태를 분리합니다)")
    .option("--context <path>", "CLI 컨텍스트 파일 경로")
    .option("--profile <name>", "프로필 이름 (기본값: 현재 프로필)")
    .option("--api-base <url>", "기본 API 기본 URL")
    .option("--company-id <id>", "기본 회사 ID")
    .option("--api-key-env-var-name <name>", "API 키가 포함된 환경 변수 (권장)")
    .option("--use", "이 프로필을 활성으로 설정")
    .option("--json", "원시 JSON 출력")
    .action((opts: ContextSetOptions) => {
      const existing = readContext(opts.context);
      const targetProfile = opts.profile?.trim() || existing.currentProfile || "default";

      upsertProfile(
        targetProfile,
        {
          apiBase: opts.apiBase,
          companyId: opts.companyId,
          apiKeyEnvVarName: opts.apiKeyEnvVarName,
        },
        opts.context,
      );

      if (opts.use) {
        setCurrentProfile(targetProfile, opts.context);
      }

      const updated = readContext(opts.context);
      const resolved = resolveProfile(updated, targetProfile);
      const payload = {
        contextPath: resolveContextPath(opts.context),
        currentProfile: updated.currentProfile,
        profileName: resolved.name,
        profile: resolved.profile,
      };

      if (!opts.json) {
        console.log(pc.green(`프로필 '${targetProfile}'이(가) 업데이트되었습니다.`));
        if (opts.use) {
          console.log(pc.green(`'${targetProfile}'이(가) 활성 프로필로 설정되었습니다.`));
        }
      }
      printOutput(payload, { json: opts.json });
    });
}
