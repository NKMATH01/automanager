import type { DashboardSummary } from "@automanager/shared";
import { api } from "./client";

export const dashboardApi = {
  summary: (companyId: string) => api.get<DashboardSummary>(`/companies/${companyId}/dashboard`),
};
