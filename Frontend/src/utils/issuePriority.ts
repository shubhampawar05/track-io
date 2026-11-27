import type { Issue, Priority } from "@/types/issue";

export type NormalizedIssuePriority = Priority;

export type IssuePriorityVisual = {
  dot: string;
  label: string;
};

/**
 * Dot colors chosen for strong separation on light and dark card backgrounds.
 * Urgent = alert red; high = violet (distinct from urgent); medium/low stay warm.
 */
const PRIORITY_VISUAL: Record<Exclude<Priority, "none">, IssuePriorityVisual> = {
  urgent: { dot: "#dc2626", label: "Urgent" },
  high: { dot: "#9333ea", label: "High" },
  medium: { dot: "#ea580c", label: "Medium" },
  low: { dot: "#ca8a04", label: "Low" },
};

const NONE_VISUAL: IssuePriorityVisual = {
  dot: "#6b7280",
  label: "No Priority",
};

export function normalizeIssuePriority(raw: unknown): NormalizedIssuePriority {
  if (raw == null || raw === "") return "none";
  const s = String(raw).toLowerCase().trim();
  if (s === "urgent" || s === "high" || s === "medium" || s === "low" || s === "none") {
    return s;
  }
  return "none";
}

export function getIssuePriorityVisual(priority: unknown): IssuePriorityVisual {
  const p = normalizeIssuePriority(priority);
  if (p === "none") return NONE_VISUAL;
  return PRIORITY_VISUAL[p];
}

export function listRowAssigneeTooltip(issue: Issue): string {
  const raw = issue.assignee?.trim() ?? "";
  if (raw === "—" || raw === "" || raw === "-") return "Unassigned";
  const name = issue.assigneeName?.trim();
  return name || raw;
}
