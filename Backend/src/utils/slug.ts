/**
 * URL slug from a display name. Unicode-aware: accents are folded ("Café" -> "cafe") and letters
 * from any script are kept ("Проект" -> "проект"), so non-Latin names no longer all collapse to
 * "project". Clients always URL-encode slugs.
 */
export function slugifyName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return base.length > 0 ? base : "project";
}

export function keyPrefixFromName(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (letters.length >= 2) return letters.slice(0, 3);
  if (letters.length === 1) return `${letters}X`;
  return "TK";
}
