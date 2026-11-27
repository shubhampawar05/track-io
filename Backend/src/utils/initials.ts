export function initialsFromName(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return initials.length > 0 ? initials : "ME";
}
