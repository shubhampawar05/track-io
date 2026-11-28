/**
 * Re-encrypts stored GitHub OAuth tokens and webhook secrets with the current
 * GITHUB_OAUTH_ENCRYPTION_KEY (see utils/secretBox). Safe to run repeatedly.
 *
 *   npm run migrate:secrets -- --dry-run      # preview
 *   npm run migrate:secrets -- --yes          # apply
 *   ... --yes --delete-undecryptable-tokens   # drop GitHub connections no key can decrypt
 *                                             # (those workspaces reconnect GitHub)
 *
 * Key rotation: set the new key in GITHUB_OAUTH_ENCRYPTION_KEY, put the old one in
 * GITHUB_OAUTH_ENCRYPTION_KEY_PREVIOUS, deploy, run this script, then remove the old key.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { migrateSecrets } from "../services/secretMigration.service";
import { confirmMaintenanceTarget } from "./confirmTarget";

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
}

async function main() {
  const { dryRun } = confirmMaintenanceTarget(uri as string, "migrate:secrets");
  await mongoose.connect(uri as string);
  const report = await migrateSecrets({
    dryRun,
    deleteUndecryptableTokens: process.argv.includes("--delete-undecryptable-tokens"),
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.githubTokens.undecryptable.length > 0 && !report.githubTokens.deleted) {
    console.warn(
      "Some GitHub tokens could not be decrypted with any configured key. Add the old key to " +
        "GITHUB_OAUTH_ENCRYPTION_KEY_PREVIOUS, or re-run with --delete-undecryptable-tokens and reconnect GitHub.",
    );
  }
  if (report.webhookSecrets.undecryptable.length > 0) {
    console.warn(
      "Some webhook secrets could not be decrypted. In those workspaces an admin must run " +
        "Integrations → GitHub → webhook setup again and paste the new secret into GitHub.",
    );
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
