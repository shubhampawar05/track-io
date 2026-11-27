import type { UniqueIdentifier } from "@dnd-kit/core";
import type { Issue } from "@/types/issue";

const BOARD_STATUS_RANK = ["backlog", "todo", "in-progress", "done", "canceled"] as const;

export function boardStatusRank(status: string): number {
  const i = BOARD_STATUS_RANK.indexOf(status as (typeof BOARD_STATUS_RANK)[number]);
  return i === -1 ? 1000 : i;
}

/** Match backend list ordering for cross-project issue lists. */
export function compareIssuesBoard(a: Issue, b: Issue): number {
  const sr = boardStatusRank(a.status) - boardStatusRank(b.status);
  if (sr !== 0) return sr;
  const slugA = String(a.projectId ?? "");
  const slugB = String(b.projectId ?? "");
  const pc = slugA.localeCompare(slugB);
  if (pc !== 0) return pc;
  const oa = a.sortOrder ?? 0;
  const ob = b.sortOrder ?? 0;
  if (oa !== ob) return oa - ob;
  return (a.key ?? a.id).localeCompare(b.key ?? b.id);
}

function sortIssuesWithinStatus(a: Issue, b: Issue): number {
  const oa = a.sortOrder ?? 0;
  const ob = b.sortOrder ?? 0;
  if (oa !== ob) return oa - ob;
  return (a.key ?? a.id).localeCompare(b.key ?? b.id);
}

/** Ordered issue ids per column status (board columns). */
export function buildBoardItemMap(issues: Issue[], columnStatuses: string[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const status of columnStatuses) {
    map[status] = issues
      .filter((i) => i.status === status)
      .sort(sortIssuesWithinStatus)
      .map((i) => i.id);
  }
  return map;
}

function placementKeyForIssue(issues: Issue[], id: string): string {
  const issue = issues.find((i) => i.id === id);
  if (!issue) return "";
  const same = issues.filter((i) => i.status === issue.status).sort(sortIssuesWithinStatus);
  const idx = same.findIndex((i) => i.id === id);
  return `${issue.status}:${idx === -1 ? 0 : idx}`;
}

export type BoardReorderEntry = {
  issueId: string;
  projectSlug: string;
  status: string;
  sortOrder: number;
};

/** Diff baseline vs final column ordering; only issues that moved or changed status. */
export function emptyBoardItemMap(columnStatuses: string[]): Record<string, string[]> {
  return Object.fromEntries(columnStatuses.map((s) => [s, [] as string[]]));
}

export function cloneBoardItemMap(m: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const k of Object.keys(m)) {
    out[k] = [...(m[k] ?? [])];
  }
  return out;
}

/** Which status column currently contains this issue id (or the column key itself). */
export function findBoardItemContainer(
  id: UniqueIdentifier,
  board: Record<string, string[]>,
): string | undefined {
  const s = String(id);
  if (s in board) return s;
  return Object.keys(board).find((key) => board[key].includes(s));
}

export function computeBoardReorderUpdates(
  baseline: Issue[],
  finalMap: Record<string, string[]>,
  columnStatuses: string[],
): BoardReorderEntry[] {
  const byId = new Map(baseline.map((i) => [i.id, i]));
  const updates: BoardReorderEntry[] = [];
  for (const status of columnStatuses) {
    const ids = finalMap[status] ?? [];
    ids.forEach((id, sortOrder) => {
      const nextKey = `${status}:${sortOrder}`;
      if (placementKeyForIssue(baseline, id) !== nextKey) {
        const issue = byId.get(id);
        if (issue?.projectId) {
          updates.push({ issueId: id, projectSlug: issue.projectId, status, sortOrder });
        }
      }
    });
  }
  return updates;
}
