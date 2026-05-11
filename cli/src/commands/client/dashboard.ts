import { Command } from "commander";
import type { DashboardSummary } from "@automanager/shared";
import {
  addCommonClientOptions,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface DashboardGetOptions extends BaseClientOptions {
  companyId?: string;
}

export function registerDashboardCommands(program: Command): void {
  const dashboard = program.command("dashboard").description("대시보드 요약 작업");

  addCommonClientOptions(
    dashboard
      .command("get")
      .description("회사의 대시보드 요약 조회")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .action(async (opts: DashboardGetOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const row = await ctx.api.get<DashboardSummary>(`/api/companies/${ctx.companyId}/dashboard`);
          printOutput(row, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );
}
