import { boardStatusRank } from "@/lib/issue-board-sort";
import type { BoardColumnDto, Status } from "@/types/issue";

/** When no board config is available yet (e.g. project still loading). */
export const FALLBACK_ISSUE_STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "canceled", label: "Cancelled" },
];

export function formatIssueStatusLabel(status: string): string {
  if (!status) return "";
  return status
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function sortIssueStatusSlugs(statuses: Iterable<string>): string[] {
  const uniq = [...new Set(statuses)];
  return uniq.sort(
    (a, b) => boardStatusRank(a) - boardStatusRank(b) || a.localeCompare(b),
  );
}

/** Maps API board columns to select rows (title preferred over slug). */
export function statusSelectOptionsFromBoardColumns(
  cols: BoardColumnDto[] | null | undefined,
): { value: Status; label: string }[] | null {
  if (!cols?.length) return null;
  return cols.map((c) => ({
    value: c.status as Status,
    label: c.title?.trim() ? c.title.trim() : formatIssueStatusLabel(c.status),
  }));
}

/** Ensures the current issue status appears even if board config lags or is partial. */
export function mergeIssueStatusIntoOptions(
  options: { value: Status; label: string }[],
  issueStatus: string,
): { value: Status; label: string }[] {
  if (options.some((o) => o.value === issueStatus)) return options;
  return [
    {
      value: issueStatus as Status,
      label: formatIssueStatusLabel(issueStatus),
    },
    ...options,
  ];
}

export function statusSelectOptionsForProjectBoard(
  boardColumns: BoardColumnDto[] | undefined | null,
): { value: Status; label: string }[] {
  const fromBoard = statusSelectOptionsFromBoardColumns(boardColumns);
  if (fromBoard?.length) return fromBoard;
  return [...FALLBACK_ISSUE_STATUS_OPTIONS];
}
