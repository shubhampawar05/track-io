const KEY_PREFIX = "track-io:dismissed-new-issue-guide";

export function newIssueGuideStorageKey(userId: string | null): string {
  return userId ? `${KEY_PREFIX}::${userId}` : KEY_PREFIX;
}

export function isNewIssueGuideDismissed(userId: string | null): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(newIssueGuideStorageKey(userId)) === "1";
  } catch {
    return true;
  }
}

export function dismissNewIssueGuide(userId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(newIssueGuideStorageKey(userId), "1");
  } catch {
    /* quota or private mode */
  }
}
