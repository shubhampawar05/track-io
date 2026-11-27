export function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length > 0 ? base : "project";
}

export function keyPrefixFromName(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (letters.length >= 2) return letters.slice(0, 3);
  if (letters.length === 1) return `${letters}X`;
  return "TK";
}
