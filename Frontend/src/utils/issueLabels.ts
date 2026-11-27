/** Keep in sync with Backend `ISSUE_LABELS` in issue.service.ts */
export const ISSUE_LABEL_OPTIONS = [
  { value: "General", label: "General" },
  { value: "Bug", label: "Bug" },
  { value: "Feature", label: "Feature" },
  { value: "Improvement", label: "Improvement" },
  { value: "Docs", label: "Docs" },
  { value: "Chore", label: "Chore" },
] as const;

export type IssueLabelValue = (typeof ISSUE_LABEL_OPTIONS)[number]["value"];

const LABEL_SET = new Set<string>(ISSUE_LABEL_OPTIONS.map((o) => o.value));

export function normalizeIssueLabel(raw: string): IssueLabelValue {
  const s = raw.trim();
  if (LABEL_SET.has(s)) return s as IssueLabelValue;
  return "General";
}
