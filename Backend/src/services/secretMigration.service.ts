import { GithubIntegration } from "../models/GithubIntegration";
import { Organization } from "../models/Organization";
import { decryptGithubAccessToken, githubTokenUpdate } from "../utils/githubTokenCrypto";
import { isSealed, isSealedWithCurrentKey, openSecret, sealSecret } from "../utils/secretBox";

export type SecretMigrationReport = {
  githubTokens: { resealed: number; alreadyCurrent: number; undecryptable: string[]; deleted: number };
  webhookSecrets: { sealedFromPlaintext: number; resealed: number; alreadyCurrent: number; undecryptable: string[] };
};

/**
 * Re-encrypts every stored GitHub secret with the current key:
 * - GitHub OAuth tokens in the legacy format or sealed with a previous key -> v2 / current key.
 * - Webhook secrets stored in plaintext or sealed with a previous key -> sealed with current key.
 * Idempotent. Values that no configured key can decrypt are reported (and, for tokens, deleted
 * when `deleteUndecryptableTokens` is set so the workspace can reconnect GitHub).
 */
export async function migrateSecrets(options: {
  dryRun?: boolean;
  deleteUndecryptableTokens?: boolean;
}): Promise<SecretMigrationReport> {
  const report: SecretMigrationReport = {
    githubTokens: { resealed: 0, alreadyCurrent: 0, undecryptable: [], deleted: 0 },
    webhookSecrets: { sealedFromPlaintext: 0, resealed: 0, alreadyCurrent: 0, undecryptable: [] },
  };

  for (const doc of await GithubIntegration.find({}).lean()) {
    const orgId = doc.organizationId.toString();
    if (isSealed(doc.sealedAccessToken) && isSealedWithCurrentKey(doc.sealedAccessToken) && !doc.encryptedAccessToken) {
      report.githubTokens.alreadyCurrent += 1;
      continue;
    }
    let plain: string;
    try {
      plain = decryptGithubAccessToken(doc);
    } catch {
      report.githubTokens.undecryptable.push(orgId);
      if (options.deleteUndecryptableTokens && !options.dryRun) {
        await GithubIntegration.deleteOne({ _id: doc._id });
        report.githubTokens.deleted += 1;
      }
      continue;
    }
    if (!options.dryRun) await GithubIntegration.updateOne({ _id: doc._id }, githubTokenUpdate(plain));
    report.githubTokens.resealed += 1;
  }

  const orgs = await Organization.find({ githubWebhookSecret: { $exists: true, $nin: [null, ""] } })
    .select("githubWebhookSecret")
    .lean();
  for (const org of orgs) {
    const stored = org.githubWebhookSecret as string;
    let plain: string;
    if (isSealed(stored)) {
      if (isSealedWithCurrentKey(stored)) {
        report.webhookSecrets.alreadyCurrent += 1;
        continue;
      }
      try {
        plain = openSecret(stored);
      } catch {
        report.webhookSecrets.undecryptable.push(org._id.toString());
        continue;
      }
      report.webhookSecrets.resealed += 1;
    } else {
      plain = stored;
      report.webhookSecrets.sealedFromPlaintext += 1;
    }
    if (!options.dryRun) await Organization.updateOne({ _id: org._id }, { $set: { githubWebhookSecret: sealSecret(plain) } });
  }
  return report;
}
