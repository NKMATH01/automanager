import { cn } from "../lib/utils";
import { statusBadge, statusBadgeDefault } from "../lib/status-colors";

const statusKorean: Record<string, string> = {
  open: "열림",
  closed: "닫힘",
  in_progress: "진행 중",
  done: "완료",
  pending: "대기 중",
  blocked: "차단됨",
  failed: "실패",
  cancelled: "취소됨",
  running: "실행 중",
  idle: "대기",
  approved: "승인됨",
  rejected: "거부됨",
  todo: "할 일",
  backlog: "백로그",
  in_review: "검토 중",
  planned: "계획됨",
  active: "활성",
  paused: "일시정지",
  completed: "완료",
  terminated: "종료됨",
  queued: "대기열",
  succeeded: "성공",
  timed_out: "시간초과",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0",
        statusBadge[status] ?? statusBadgeDefault
      )}
    >
      {statusKorean[status] ?? status.replace("_", " ")}
    </span>
  );
}
