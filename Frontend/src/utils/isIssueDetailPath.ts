/** True for `/issues/:id` (not list, board, or nested paths). */
export function isIssueDetailPath(pathname: string): boolean {
  if (!pathname.startsWith("/issues/")) return false;
  if (pathname === "/issues/list" || pathname === "/issues/board") return false;
  const parts = pathname.split("/").filter(Boolean);
  return parts.length === 2 && parts[0] === "issues";
}
