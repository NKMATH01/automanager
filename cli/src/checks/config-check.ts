import { readConfig, configExists, resolveConfigPath } from "../config/store.js";
import type { CheckResult } from "./index.js";

export function configCheck(configPath?: string): CheckResult {
  const filePath = resolveConfigPath(configPath);

  if (!configExists(configPath)) {
    return {
      name: "설정 파일",
      status: "fail",
      message: `${filePath}에서 설정 파일을 찾을 수 없습니다`,
      canRepair: false,
      repairHint: "`automanager onboard`를 실행하여 생성하세요",
    };
  }

  try {
    readConfig(configPath);
    return {
      name: "설정 파일",
      status: "pass",
      message: `${filePath}에 유효한 설정`,
    };
  } catch (err) {
    return {
      name: "설정 파일",
      status: "fail",
      message: `유효하지 않은 설정: ${err instanceof Error ? err.message : String(err)}`,
      canRepair: false,
      repairHint: "`automanager configure --section database`를 실행하세요 (또는 `automanager onboard`로 재생성)",
    };
  }
}
