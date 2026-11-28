/**
 * Safety guard for destructive / demo-data scripts (db:reset, seed).
 *
 * - Always refuses when NODE_ENV=production.
 * - Runs freely against a local MongoDB (localhost / 127.0.0.1 / ::1).
 * - Against any other host (e.g. Atlas) it requires an explicit
 *   `--allow-remote=<databaseName>` argument naming the target database.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function parseMongoUri(uri: string): { hosts: string[]; isSrv: boolean; databaseName: string } {
  const match = /^mongodb(\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/i.exec(uri.trim());
  if (!match) throw new Error("MONGODB_URI is not a valid mongodb:// or mongodb+srv:// connection string");
  const hosts = match[2]!
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .map((h) => (h.startsWith("[") ? h.slice(0, h.indexOf("]") + 1) : h.split(":")[0]!));
  return { hosts, isSrv: Boolean(match[1]), databaseName: decodeURIComponent(match[3] ?? "") || "test" };
}

export function assertSafeDatabaseTarget(uri: string, scriptName: string): void {
  if (process.env.NODE_ENV?.trim() === "production") {
    console.error(`[${scriptName}] Refusing to run with NODE_ENV=production.`);
    process.exit(1);
  }
  const { hosts, isSrv, databaseName } = parseMongoUri(uri);
  const isLocal = !isSrv && hosts.every((h) => LOCAL_HOSTS.has(h));
  if (isLocal) return;

  const flag = process.argv.find((a) => a.startsWith("--allow-remote="));
  const confirmed = flag?.slice("--allow-remote=".length);
  if (confirmed === databaseName) {
    console.warn(`[${scriptName}] Running against REMOTE database "${databaseName}" (${hosts.join(", ")}).`);
    return;
  }
  console.error(
    [
      `[${scriptName}] Refusing to run against a non-local database "${databaseName}" (${hosts.join(", ")}).`,
      `If you really mean it, re-run with: npm run ${scriptName} -- --allow-remote=${databaseName}`,
    ].join("\n"),
  );
  process.exit(1);
}
