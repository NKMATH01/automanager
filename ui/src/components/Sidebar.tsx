import {
  Inbox,
  CircleDot,
  Target,
  LayoutDashboard,
  DollarSign,
  History,
  Search,
  SquarePen,
  Network,
  Boxes,
  Repeat,
  Settings,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarAgents } from "./SidebarAgents";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { heartbeatsApi } from "../api/heartbeats";
import { queryKeys } from "../lib/queryKeys";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { Button } from "@/components/ui/button";
import { PluginSlotOutlet } from "@/plugins/slots";

export function Sidebar() {
  const { openNewIssue } = useDialog();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const inboxBadge = useInboxBadge(selectedCompanyId);
  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });
  const liveRunCount = liveRuns?.length ?? 0;

  function openSearch() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  const pluginContext = {
    companyId: selectedCompanyId,
    companyPrefix: selectedCompany?.issuePrefix ?? null,
  };

  return (
    <aside className="w-72 h-full min-h-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">
      {/* Top bar: Company name (bold) + Search — aligned with top sections (no visible border) */}
      <div className="flex items-center gap-2 px-4 h-16 shrink-0 border-b border-sidebar-border/70">
        {selectedCompany?.brandColor && (
          <div
            className="w-5 h-5 rounded-md shrink-0"
            style={{ backgroundColor: selectedCompany.brandColor }}
          />
        )}
        <span className="flex-1 text-base font-semibold text-sidebar-foreground truncate">
          {selectedCompany?.name ?? "회사 선택"}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={openSearch}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-5 px-4 py-4">
        <div className="flex flex-col gap-1">
          {/* New Issue button aligned with nav items */}
          <button
            onClick={() => openNewIssue()}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <SquarePen className="h-4 w-4 shrink-0" />
            <span className="truncate">새 이슈</span>
          </button>
          <SidebarNavItem to="/dashboard" label="대시보드" icon={LayoutDashboard} liveCount={liveRunCount} />
          <SidebarNavItem
            to="/inbox"
            label="수신함"
            icon={Inbox}
            badge={inboxBadge.inbox}
            badgeTone={inboxBadge.failedRuns > 0 ? "danger" : "default"}
            alert={inboxBadge.failedRuns > 0}
          />
          <PluginSlotOutlet
            slotTypes={["sidebar"]}
            context={pluginContext}
            className="flex flex-col gap-1"
            itemClassName="text-[15px] font-medium"
            missingBehavior="placeholder"
          />
        </div>

        <SidebarSection label="업무">
          <SidebarNavItem to="/issues" label="이슈" icon={CircleDot} />
          <SidebarNavItem to="/routines" label="루틴" icon={Repeat} textBadge="베타" textBadgeTone="amber" />
          <SidebarNavItem to="/goals" label="목표" icon={Target} />
        </SidebarSection>

        <SidebarProjects />

        <SidebarAgents />

        <SidebarSection label="회사">
          <SidebarNavItem to="/org" label="조직" icon={Network} />
          <SidebarNavItem to="/skills" label="스킬" icon={Boxes} />
          <SidebarNavItem to="/costs" label="비용" icon={DollarSign} />
          <SidebarNavItem to="/activity" label="활동" icon={History} />
          <SidebarNavItem to="/company/settings" label="설정" icon={Settings} />
        </SidebarSection>

        <PluginSlotOutlet
          slotTypes={["sidebarPanel"]}
          context={pluginContext}
          className="flex flex-col gap-3"
          itemClassName="rounded-lg border border-sidebar-border bg-background/45 p-3"
          missingBehavior="placeholder"
        />
      </nav>
    </aside>
  );
}
