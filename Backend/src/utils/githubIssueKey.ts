/**
 * Extract issue displayIds (e.g. ABC-12) from free text using known project key prefixes.
 * Matching is case-insensitive; returned ids use each project's canonical keyPrefix casing.
 */
export function resolveDisplayIdsFromText(text: string, keyPrefixes: string[]): string[] {
  if (!text || keyPrefixes.length === 0) return [];
  const uniqPrefixes = [...new Set(keyPrefixes.map((p) => p.trim()).filter(Boolean))];
  if (uniqPrefixes.length === 0) return [];
  const lowerToCanonical = new Map<string, string>();
  for (const p of uniqPrefixes) {
    lowerToCanonical.set(p.toLowerCase(), p);
  }
  const esc = uniqPrefixes.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`\\b(?:${esc.join("|")})-(\\d+)\\b`, "gi");
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const full = m[0];
    const numStr = m[1];
    const dash = full.lastIndexOf("-");
    const rawPrefix = dash > 0 ? full.slice(0, dash) : "";
    if (!numStr || !rawPrefix) continue;
    const canon = lowerToCanonical.get(rawPrefix.toLowerCase());
    if (!canon) continue;
    const displayId = `${canon}-${numStr}`;
    if (!seen.has(displayId)) {
      seen.add(displayId);
      out.push(displayId);
    }
  }
  return out;
}
