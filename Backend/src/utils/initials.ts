/** Up to three initials. Iterates code points so emoji / astral characters are never split. */
export function initialsFromName(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((p) => Array.from(p)[0] ?? "")
    .join("");
  const upper = Array.from(initials.toLocaleUpperCase()).slice(0, 3).join("");
  return upper.length > 0 ? upper : "ME";
}
