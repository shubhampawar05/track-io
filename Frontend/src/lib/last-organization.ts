const PREFIX = "trackio:lastOrg:";

export function lastOrganizationStorageKey(userId: string): string {
  return `${PREFIX}${userId}`;
}

export function readLastOrganizationId(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(lastOrganizationStorageKey(userId))?.trim();
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function writeLastOrganizationId(userId: string, organizationId: string): void {
  try {
    localStorage.setItem(lastOrganizationStorageKey(userId), organizationId);
  } catch {
    /* ignore */
  }
}
