/**
 * Accept `owner/repo`, `owner/repo.git`, full `https://github.com/owner/repo(.git)?`, or `github.com/owner/repo`.
 * Returns normalized `owner/repo` lowercase (never a trailing `.git` on the repo segment).
 */
export function normalizeGithubRepoFullNameInput(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const fromUrl = s.match(/github\.com\/([^/]+)\/([^/?#]+)/i);
  if (fromUrl) {
    const owner = fromUrl[1];
    const repo = fromUrl[2].replace(/\.git$/i, "");
    if (owner && repo) return `${owner}/${repo}`.toLowerCase();
  }
  const t = s.toLowerCase();
  const slash = t.indexOf("/");
  if (slash > 0 && slash < t.length - 1 && !t.slice(slash + 1).includes("/")) {
    const owner = t.slice(0, slash);
    const repo = t.slice(slash + 1).replace(/\.git$/i, "");
    if (owner && repo) return `${owner}/${repo}`;
  }
  return t.replace(/\.git$/i, "");
}
