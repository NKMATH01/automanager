import fs from "node:fs";
import type { PaperclipConfig } from "../config/schema.js";
import type { CheckResult } from "./index.js";
import { resolveRuntimeLikePath } from "./path-resolver.js";

export async function databaseCheck(config: PaperclipConfig, configPath?: string): Promise<CheckResult> {
  if (config.database.mode === "postgres") {
    if (!config.database.connectionString) {
      return {
        name: "데이터베이스",
        status: "fail",
        message: "PostgreSQL 모드가 선택되었지만 연결 문자열이 설정되지 않았습니다",
        canRepair: false,
        repairHint: "`automanager configure --section database`를 실행하세요",
      };
    }

    try {
      const { createDb } = await import("@automanager/db");
      const db = createDb(config.database.connectionString);
      await db.execute("SELECT 1");
      return {
        name: "데이터베이스",
        status: "pass",
        message: "PostgreSQL 연결 성공",
      };
    } catch (err) {
      return {
        name: "데이터베이스",
        status: "fail",
        message: `PostgreSQL에 연결할 수 없습니다: ${err instanceof Error ? err.message : String(err)}`,
        canRepair: false,
        repairHint: "연결 문자열을 확인하고 PostgreSQL이 실행 중인지 확인하세요",
      };
    }
  }

  if (config.database.mode === "embedded-postgres") {
    const dataDir = resolveRuntimeLikePath(config.database.embeddedPostgresDataDir, configPath);
    const reportedPath = dataDir;
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(reportedPath, { recursive: true });
    }

    return {
      name: "데이터베이스",
      status: "pass",
      message: `내장 PostgreSQL이 ${dataDir}에 설정됨 (포트 ${config.database.embeddedPostgresPort})`,
    };
  }

  return {
    name: "데이터베이스",
    status: "fail",
    message: `알 수 없는 데이터베이스 모드: ${String(config.database.mode)}`,
    canRepair: false,
    repairHint: "`automanager configure --section database`를 실행하세요",
  };
}
