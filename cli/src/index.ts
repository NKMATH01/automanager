import { Command } from "commander";
import { onboard } from "./commands/onboard.js";
import { doctor } from "./commands/doctor.js";
import { envCommand } from "./commands/env.js";
import { configure } from "./commands/configure.js";
import { addAllowedHostname } from "./commands/allowed-hostname.js";
import { heartbeatRun } from "./commands/heartbeat-run.js";
import { runCommand } from "./commands/run.js";
import { bootstrapCeoInvite } from "./commands/auth-bootstrap-ceo.js";
import { dbBackupCommand } from "./commands/db-backup.js";
import { registerContextCommands } from "./commands/client/context.js";
import { registerCompanyCommands } from "./commands/client/company.js";
import { registerIssueCommands } from "./commands/client/issue.js";
import { registerAgentCommands } from "./commands/client/agent.js";
import { registerApprovalCommands } from "./commands/client/approval.js";
import { registerActivityCommands } from "./commands/client/activity.js";
import { registerDashboardCommands } from "./commands/client/dashboard.js";
import { applyDataDirOverride, type DataDirOptionLike } from "./config/data-dir.js";
import { loadPaperclipEnvFile } from "./config/env.js";
import { registerWorktreeCommands } from "./commands/worktree.js";
import { registerPluginCommands } from "./commands/client/plugin.js";
import { registerClientAuthCommands } from "./commands/client/auth.js";

const program = new Command();
const DATA_DIR_OPTION_HELP =
  "오토매니저 데이터 디렉터리 루트 (~/.automanager와 상태를 분리합니다)";

program
  .name("automanager")
  .description("오토매니저 CLI — 인스턴스 설정, 진단 및 구성")
  .version("0.2.7");

program.hook("preAction", (_thisCommand, actionCommand) => {
  const options = actionCommand.optsWithGlobals() as DataDirOptionLike;
  const optionNames = new Set(actionCommand.options.map((option) => option.attributeName()));
  applyDataDirOverride(options, {
    hasConfigOption: optionNames.has("config"),
    hasContextOption: optionNames.has("context"),
  });
  loadPaperclipEnvFile(options.config);
});

program
  .command("onboard")
  .description("오토매니저 초기 설정 마법사")
  .option("-c, --config <path>", "설정 파일 경로")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("-y, --yes", "기본값 사용 (빠른 설정 + 즉시 시작)", false)
  .option("--run", "설정 저장 후 오토매니저를 즉시 시작", false)
  .action(onboard);

program
  .command("doctor")
  .description("오토매니저 설정에 대한 진단 검사 실행")
  .option("-c, --config <path>", "설정 파일 경로")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("--repair", "문제를 자동으로 복구 시도")
  .alias("--fix")
  .option("-y, --yes", "복구 확인 프롬프트 건너뛰기")
  .action(async (opts) => {
    await doctor(opts);
  });

program
  .command("env")
  .description("배포용 환경 변수 출력")
  .option("-c, --config <path>", "설정 파일 경로")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .action(envCommand);

program
  .command("configure")
  .description("설정 섹션 업데이트")
  .option("-c, --config <path>", "설정 파일 경로")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("-s, --section <section>", "설정할 섹션 (llm, database, logging, server, storage, secrets)")
  .action(configure);

program
  .command("db:backup")
  .description("현재 설정을 사용하여 데이터베이스 일회성 백업 생성")
  .option("-c, --config <path>", "설정 파일 경로")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("--dir <path>", "백업 출력 디렉터리 (설정값 재정의)")
  .option("--retention-days <days>", "정리에 사용되는 보관 기간", (value) => Number(value))
  .option("--filename-prefix <prefix>", "백업 파일명 접두사", "paperclip")
  .option("--json", "백업 메타데이터를 JSON으로 출력")
  .action(async (opts) => {
    await dbBackupCommand(opts);
  });

program
  .command("allowed-hostname")
  .description("인증/비공개 모드 접근을 위한 호스트명 허용")
  .argument("<host>", "허용할 호스트명 (예: dotta-macbook-pro)")
  .option("-c, --config <path>", "설정 파일 경로")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .action(addAllowedHostname);

program
  .command("run")
  .description("로컬 설정 (onboard + doctor) 후 오토매니저 실행")
  .option("-c, --config <path>", "설정 파일 경로")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("-i, --instance <id>", "로컬 인스턴스 ID (기본값: default)")
  .option("--repair", "진단 중 자동 복구 시도", true)
  .option("--no-repair", "진단 중 자동 복구 비활성화")
  .action(runCommand);

const heartbeat = program.command("heartbeat").description("하트비트 유틸리티");

heartbeat
  .command("run")
  .description("에이전트 하트비트 1회 실행 및 실시간 로그 스트리밍")
  .requiredOption("-a, --agent-id <agentId>", "호출할 에이전트 ID")
  .option("-c, --config <path>", "설정 파일 경로")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("--context <path>", "CLI 컨텍스트 파일 경로")
  .option("--profile <name>", "CLI 컨텍스트 프로필 이름")
  .option("--api-base <url>", "오토매니저 서버 API 기본 URL")
  .option("--api-key <token>", "에이전트 인증 호출용 Bearer 토큰")
  .option(
    "--source <source>",
    "호출 소스 (timer | assignment | on_demand | automation)",
    "on_demand",
  )
  .option("--trigger <trigger>", "트리거 상세 (manual | ping | callback | system)", "manual")
  .option("--timeout-ms <ms>", "포기하기 전 최대 대기 시간", "0")
  .option("--json", "해당되는 경우 원시 JSON 출력")
  .option("--debug", "원시 어댑터 stdout/stderr JSON 청크 표시")
  .action(heartbeatRun);

registerContextCommands(program);
registerCompanyCommands(program);
registerIssueCommands(program);
registerAgentCommands(program);
registerApprovalCommands(program);
registerActivityCommands(program);
registerDashboardCommands(program);
registerWorktreeCommands(program);
registerPluginCommands(program);

const auth = program.command("auth").description("인증 및 부트스트랩 유틸리티");

auth
  .command("bootstrap-ceo")
  .description("첫 번째 인스턴스 관리자를 위한 일회성 부트스트랩 초대 URL 생성")
  .option("-c, --config <path>", "설정 파일 경로")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("--force", "관리자가 이미 존재해도 새 초대 생성", false)
  .option("--expires-hours <hours>", "초대 만료 기간 (시간 단위)", (value) => Number(value))
  .option("--base-url <url>", "초대 링크 출력에 사용할 공개 기본 URL")
  .action(bootstrapCeoInvite);

registerClientAuthCommands(auth);

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
