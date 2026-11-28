import type { UniqueIdentifier } from "@dnd-kit/core";
import type { Issue } from "@/types/issue";

const BOARD_STATUS_RANK = ["backlog", "todo", "in-progress", "done", "canceled"] as const;

export function boardStatusRank(status: string): number {
  const i = BOARD_STATUS_RANK.indexOf(status as (typeof BOARD_STATUS_RANK)[number]);
  return i === -1 ? 1000 : i;
}

/** Tie-break by key with numeric awareness so ABC-9 sorts before ABC-10 (matches backend `number` order). */
function compareIssueKeys(a: Issue, b: Issue): number {
  return (a.key ?? a.id).localeCompare(b.key ?? b.id, undefined, { numeric: true });
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
  return compareIssueKeys(a, b);
}

function sortIssuesWithinStatus(a: Issue, b: Issue): number {
  const oa = a.sortOrder ?? 0;
  const ob = b.sortOrder ?? 0;
  if (oa !== ob) return oa - ob;
  return compareIssueKeys(a, b);
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

export type BoardReorderEntry = {
  issueId: string;
  projectSlug: string;
  status: string;
  sortOrder: number;
};

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

/**
 * Single-PATCH board move: the dragged card gets a sortOrder between its new visible neighbours
 * (midpoint), `first - 1` / `last + 1` at the column edges, or 0 in an empty column. Other cards
 * are never rewritten, so the result does not depend on which subset of cards is visible.
 * Returns `null` when the card did not change column or position.
 */
export function computeBoardMoveUpdate(
  baseline: Issue[],
  baselineMap: Record<string, string[]>,
  finalMap: Record<string, string[]>,
  issueId: string,
): BoardReorderEntry | null {
  const byId = new Map(baseline.map((i) => [i.id, i]));
  const issue = byId.get(issueId);
  if (!issue?.projectId) return null;
  const status = findBoardItemContainer(issueId, finalMap);
  if (!status) return null;
  const ids = finalMap[status] ?? [];
  const idx = ids.indexOf(issueId);
  if (idx === -1) return null;

  const baselineStatus = findBoardItemContainer(issueId, baselineMap);
  if (baselineStatus === status && (baselineMap[status] ?? []).indexOf(issueId) === idx) {
    return null;
  }

  const orderOf = (id: string | undefined): number | undefined => {
    if (id == null) return undefined;
    const o = byId.get(id)?.sortOrder;
    return typeof o === "number" && Number.isFinite(o) ? o : 0;
  };
  const above = orderOf(ids[idx - 1]);
  const below = orderOf(ids[idx + 1]);

  let sortOrder: number;
  if (above === undefined && below === undefined) sortOrder = 0;
  else if (above === undefined) sortOrder = (below as number) - 1;
  else if (below === undefined) sortOrder = above + 1;
  else sortOrder = (above + below) / 2;

  return { issueId, projectSlug: issue.projectId, status, sortOrder };
}
