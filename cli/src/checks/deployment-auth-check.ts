import type { PaperclipConfig } from "../config/schema.js";
import type { CheckResult } from "./index.js";

function isLoopbackHost(host: string) {
  const normalized = host.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
}

export function deploymentAuthCheck(config: PaperclipConfig): CheckResult {
  const mode = config.server.deploymentMode;
  const exposure = config.server.exposure;
  const auth = config.auth;

  if (mode === "local_trusted") {
    if (!isLoopbackHost(config.server.host)) {
      return {
        name: "배포/인증 모드",
        status: "fail",
        message: `local_trusted는 루프백 호스트 바인딩이 필요합니다 (발견: ${config.server.host})`,
        canRepair: false,
        repairHint: "`automanager configure --section server`를 실행하고 호스트를 127.0.0.1로 설정하세요",
      };
    }
    return {
      name: "배포/인증 모드",
      status: "pass",
      message: "local_trusted 모드가 루프백 전용 접근으로 설정됨",
    };
  }

  const secret =
    process.env.BETTER_AUTH_SECRET?.trim() ??
    process.env.AUTOMANAGER_AGENT_JWT_SECRET?.trim();
  if (!secret) {
    return {
      name: "배포/인증 모드",
      status: "fail",
      message: "인증 모드에는 BETTER_AUTH_SECRET (또는 AUTOMANAGER_AGENT_JWT_SECRET)이 필요합니다",
      canRepair: false,
      repairHint: "오토매니저를 시작하기 전에 BETTER_AUTH_SECRET을 설정하세요",
    };
  }

  if (auth.baseUrlMode === "explicit" && !auth.publicBaseUrl) {
    return {
      name: "배포/인증 모드",
      status: "fail",
      message: "auth.baseUrlMode=explicit에는 auth.publicBaseUrl이 필요합니다",
      canRepair: false,
      repairHint: "`automanager configure --section server`를 실행하고 기본 URL을 제공하세요",
    };
  }

  if (exposure === "public") {
    if (auth.baseUrlMode !== "explicit" || !auth.publicBaseUrl) {
      return {
        name: "배포/인증 모드",
        status: "fail",
        message: "authenticated/public에는 명시적 auth.publicBaseUrl이 필요합니다",
        canRepair: false,
        repairHint: "`automanager configure --section server`를 실행하고 공개 노출을 선택하세요",
      };
    }
    try {
      const url = new URL(auth.publicBaseUrl);
      if (url.protocol !== "https:") {
        return {
          name: "배포/인증 모드",
          status: "warn",
          message: "공개 노출은 https:// auth.publicBaseUrl을 사용해야 합니다",
          canRepair: false,
          repairHint: "안전한 세션 쿠키를 위해 프로덕션에서 HTTPS를 사용하세요",
        };
      }
    } catch {
      return {
        name: "배포/인증 모드",
        status: "fail",
        message: "auth.publicBaseUrl이 유효한 URL이 아닙니다",
        canRepair: false,
        repairHint: "`automanager configure --section server`를 실행하고 유효한 URL을 제공하세요",
      };
    }
  }

  return {
    name: "배포/인증 모드",
    status: "pass",
    message: `모드 ${mode}/${exposure}, 인증 URL 모드 ${auth.baseUrlMode}`,
  };
}
