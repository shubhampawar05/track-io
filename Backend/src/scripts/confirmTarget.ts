import { parseMongoUri } from "./dbGuard";

/**
 * For maintenance scripts that are meant to run against any database, production included
 * (unlike seed/db:reset): print the target and require an explicit --yes, or --dry-run.
 */
export function confirmMaintenanceTarget(uri: string, scriptName: string): { dryRun: boolean } {
  const { hosts, databaseName } = parseMongoUri(uri);
  const dryRun = process.argv.includes("--dry-run");
  console.log(`[${scriptName}] Target database "${databaseName}" on ${hosts.join(", ")}${dryRun ? " (dry run)" : ""}`);
  if (!dryRun && !process.argv.includes("--yes")) {
    console.error(`[${scriptName}] Re-run with --dry-run to preview, or --yes to apply: npm run ${scriptName} -- --yes`);
    process.exit(1);
  }
  return { dryRun };
}
