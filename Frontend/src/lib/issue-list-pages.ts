import type { ApiResponse } from "@/lib/api-response";

/**
 * Upper bound on pages fetched for one workspace-wide list (1000 issues per page). Beyond this
 * the list is shown incomplete with a notice instead of downloading without limit.
 */
export const MAX_ISSUE_LIST_PAGES = 10;

export type IssueListResult<T> = {
  issues: T[];
  /** Issues matching the filters on the server; larger than `issues.length` when capped. */
  total: number;
};

type PageResponse<T> = { headers: Headers; payload: ApiResponse<T[]> };

/**
 * Follows the API's `X-Next-Offset` paging header until the end (or `maxPages`), merging
 * pages and dropping duplicates (an issue updated mid-fetch can move between pages).
 */
export async function fetchAllIssuePages<T extends { id: string }>(
  path: string,
  fetchPage: (url: string) => Promise<PageResponse<T>>,
  maxPages = MAX_ISSUE_LIST_PAGES,
): Promise<IssueListResult<T>> {
  const sep = path.includes("?") ? "&" : "?";
  const byId = new Map<string, T>();
  let total = 0;
  let offset: number | null = 0;
  for (let page = 0; page < maxPages && offset !== null; page++) {
    const r = await fetchPage(offset === 0 ? path : `${path}${sep}offset=${offset}`);
    if (!r.payload.success) throw new Error(r.payload.error);
    for (const issue of r.payload.data) byId.set(issue.id, issue);
    const headerTotal = Number(r.headers.get("X-Total-Count"));
    total = Number.isFinite(headerTotal) && headerTotal > 0 ? headerTotal : byId.size;
    const next = Number(r.headers.get("X-Next-Offset"));
    offset = r.headers.get("X-Next-Offset") && Number.isFinite(next) && next > offset ? next : null;
  }
  return { issues: [...byId.values()], total: Math.max(total, byId.size) };
}
