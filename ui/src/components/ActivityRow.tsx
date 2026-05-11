import { Link } from "@/lib/router";
import { Identity } from "./Identity";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";
import { deriveProjectUrlKey, type ActivityEvent, type Agent } from "@automanager/shared";

const ACTION_VERBS: Record<string, string> = {
  "issue.created": "생성됨",
  "issue.updated": "수정됨",
  "issue.checked_out": "체크아웃됨",
  "issue.released": "릴리스됨",
  "issue.comment_added": "댓글 작성",
  "issue.attachment_added": "파일 첨부",
  "issue.attachment_removed": "첨부파일 제거",
  "issue.document_created": "문서 생성",
  "issue.document_updated": "문서 수정",
  "issue.document_deleted": "문서 삭제",
  "issue.commented": "댓글 작성",
  "issue.deleted": "삭제됨",
  "agent.created": "생성됨",
  "agent.updated": "수정됨",
  "agent.paused": "일시정지됨",
  "agent.resumed": "재개됨",
  "agent.terminated": "종료됨",
  "agent.key_created": "API 키 생성",
  "agent.budget_updated": "예산 수정",
  "agent.runtime_session_reset": "세션 초기화",
  "heartbeat.invoked": "하트비트 실행",
  "heartbeat.cancelled": "하트비트 취소",
  "approval.created": "승인 요청",
  "approval.approved": "승인됨",
  "approval.rejected": "거부됨",
  "project.created": "생성됨",
  "project.updated": "수정됨",
  "project.deleted": "삭제됨",
  "goal.created": "생성됨",
  "goal.updated": "수정됨",
  "goal.deleted": "삭제됨",
  "cost.reported": "비용 보고",
  "cost.recorded": "비용 기록",
  "company.created": "회사 생성",
  "company.updated": "회사 수정",
  "company.archived": "보관됨",
  "company.budget_updated": "예산 수정",
};

function humanizeValue(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "none");
  return value.replace(/_/g, " ");
}

function formatVerb(action: string, details?: Record<string, unknown> | null): string {
  if (action === "issue.updated" && details) {
    const previous = (details._previous ?? {}) as Record<string, unknown>;
    if (details.status !== undefined) {
      const from = previous.status;
      return from
        ? `changed status from ${humanizeValue(from)} to ${humanizeValue(details.status)} on`
        : `changed status to ${humanizeValue(details.status)} on`;
    }
    if (details.priority !== undefined) {
      const from = previous.priority;
      return from
        ? `changed priority from ${humanizeValue(from)} to ${humanizeValue(details.priority)} on`
        : `changed priority to ${humanizeValue(details.priority)} on`;
    }
  }
  return ACTION_VERBS[action] ?? action.replace(/[._]/g, " ");
}

function entityLink(entityType: string, entityId: string, name?: string | null): string | null {
  switch (entityType) {
    case "issue": return `/issues/${name ?? entityId}`;
    case "agent": return `/agents/${entityId}`;
    case "project": return `/projects/${deriveProjectUrlKey(name, entityId)}`;
    case "goal": return `/goals/${entityId}`;
    case "approval": return `/approvals/${entityId}`;
    default: return null;
  }
}

interface ActivityRowProps {
  event: ActivityEvent;
  agentMap: Map<string, Agent>;
  entityNameMap: Map<string, string>;
  entityTitleMap?: Map<string, string>;
  className?: string;
}

export function ActivityRow({ event, agentMap, entityNameMap, entityTitleMap, className }: ActivityRowProps) {
  const verb = formatVerb(event.action, event.details);

  const isHeartbeatEvent = event.entityType === "heartbeat_run";
  const heartbeatAgentId = isHeartbeatEvent
    ? (event.details as Record<string, unknown> | null)?.agentId as string | undefined
    : undefined;

  const name = isHeartbeatEvent
    ? (heartbeatAgentId ? entityNameMap.get(`agent:${heartbeatAgentId}`) : null)
    : entityNameMap.get(`${event.entityType}:${event.entityId}`);

  const entityTitle = entityTitleMap?.get(`${event.entityType}:${event.entityId}`);

  const link = isHeartbeatEvent && heartbeatAgentId
    ? `/agents/${heartbeatAgentId}/runs/${event.entityId}`
    : entityLink(event.entityType, event.entityId, name);

  const actor = event.actorType === "agent" ? agentMap.get(event.actorId) : null;
  const actorName = actor?.name ?? (event.actorType === "system" ? "System" : event.actorType === "user" ? "Board" : event.actorId || "Unknown");

  const inner = (
    <div className="flex gap-3">
      <p className="flex-1 min-w-0 truncate">
        <Identity
          name={actorName}
          size="xs"
          className="align-baseline"
        />
        <span className="text-muted-foreground ml-1">{verb} </span>
        {name && <span className="font-medium">{name}</span>}
        {entityTitle && <span className="text-muted-foreground ml-1">— {entityTitle}</span>}
      </p>
      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{timeAgo(event.createdAt)}</span>
    </div>
  );

  const classes = cn(
    "px-4 py-2 text-sm",
    link && "cursor-pointer hover:bg-accent/50 transition-colors",
    className,
  );

  if (link) {
    return (
      <Link to={link} className={cn(classes, "no-underline text-inherit block")}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={classes}>
      {inner}
    </div>
  );
}
