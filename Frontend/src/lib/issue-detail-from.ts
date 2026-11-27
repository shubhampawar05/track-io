/** Query contract when opening an issue: `?from=board|list|project&projectSlug=&view=` */

export type IssueNavFrom = "board" | "list" | "project";

export function buildIssueOpenQuery(opts: {
  from: IssueNavFrom;
  projectSlug?: string | null;
  projectView?: "list" | "board";
}): string {
  const q = new URLSearchParams();
  if (opts.from === "project" && opts.projectSlug) {
    q.set("from", "project");
    q.set("projectSlug", opts.projectSlug);
    q.set("view", opts.projectView ?? "list");
  } else {
    q.set("from", opts.from);
  }
  return `?${q.toString()}`;
}

export function buildIssueDetailUrl(
  issueId: string,
  opts: {
    from: IssueNavFrom;
    projectSlug?: string | null;
    projectView?: "list" | "board";
  },
): string {
  return `/issues/${encodeURIComponent(issueId)}${buildIssueOpenQuery(opts)}`;
}

export function resolveIssueCloseHref(searchParams: URLSearchParams): string {
  const from = searchParams.get("from");
  if (from === "list") return "/issues/list";
  if (from === "board") return "/issues/board";
  if (from === "project") {
    const slug = searchParams.get("projectSlug");
    const view = searchParams.get("view") === "board" ? "board" : "list";
    if (slug) return `/projects/${encodeURIComponent(slug)}?view=${view}`;
  }
  return "/issues/board";
}
