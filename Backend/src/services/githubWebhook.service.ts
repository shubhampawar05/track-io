import mongoose from "mongoose";
import { Organization } from "../models/Organization";
import { verifyGithubWebhookSignature } from "../utils/githubWebhookSignature";
import { isSealed, openSecret } from "../utils/secretBox";
import { collectDisplayIdsForGithubPayload, repoFullNameAllowedForOrg, upsertGithubLinksForIssues } from "./githubLink.service";

type PullRequestPayload = {
  action?: string;
  pull_request?: {
    number?: number;
    html_url?: string;
    title?: string;
    state?: string;
    merged?: boolean;
    body?: string | null;
    head?: { ref?: string; repo?: { owner?: { login?: string }; name?: string } };
  };
  repository?: { full_name?: string; owner?: { login?: string }; name?: string };
};

type PushPayload = {
  ref?: string;
  repository?: { full_name?: string; owner?: { login?: string }; name?: string };
};

function repoParts(fullName: string | undefined, repo?: { owner?: { login?: string }; name?: string }): { owner: string; repo: string } | null {
  if (fullName && fullName.includes("/")) {
    const [owner, name] = fullName.split("/");
    if (owner && name) return { owner, repo: name };
  }
  const owner = repo?.owner?.login;
  const name = repo?.name;
  if (owner && name) return { owner, repo: name };
  return null;
}

export async function handleGithubWebhook(
  webhookPathToken: string,
  rawBody: Buffer,
  signatureHeader: string | undefined,
  githubEvent: string | undefined,
): Promise<{ ok: boolean; status: number; message?: string }> {
  const org = await Organization.findOne({ githubWebhookPathToken: webhookPathToken }).lean();
  if (!org || !org.githubWebhookSecret) {
    return { ok: false, status: 404, message: "Not found" };
  }
  let secret: string;
  try {
    // Sealed (v2) secrets are decrypted; legacy plaintext secrets still work until migrated.
    secret = isSealed(org.githubWebhookSecret) ? openSecret(org.githubWebhookSecret) : org.githubWebhookSecret;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GitHub webhook secret could not be decrypted (check encryption keys)", err);
    return { ok: false, status: 500, message: "Webhook secret unavailable" };
  }
  if (!verifyGithubWebhookSignature(rawBody, signatureHeader, secret)) {
    return { ok: false, status: 401, message: "Invalid signature" };
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
  } catch {
    return { ok: false, status: 400, message: "Invalid JSON" };
  }

  const ev = (githubEvent ?? "").toLowerCase();
  if (ev === "ping") {
    return { ok: true, status: 200 };
  }

  const organizationId = org._id as mongoose.Types.ObjectId;

  if (ev === "pull_request") {
    const j = json as Record<string, unknown>;
    const repository = j.repository as PullRequestPayload["repository"] | undefined;
    const fullName = repository?.full_name;
    const allowed = await repoFullNameAllowedForOrg(organizationId, fullName ?? "");
    if (!allowed) return { ok: true, status: 200 };
    const rp = repoParts(fullName, repository as { owner?: { login?: string }; name?: string });
    const pr = j.pull_request as PullRequestPayload["pull_request"] | undefined;
    const prNum = pr && typeof pr.number === "number" && Number.isFinite(pr.number) ? pr.number : undefined;
    if (!rp || !pr || prNum == null) return { ok: true, status: 200 };
    const headRef = pr.head?.ref ?? "";
    const texts = [headRef, pr.title ?? "", pr.body ?? ""].filter(Boolean) as string[];
    const displayIds = await collectDisplayIdsForGithubPayload(organizationId, texts, fullName ?? "");
    if (displayIds.length === 0) return { ok: true, status: 200 };

    await upsertGithubLinksForIssues(organizationId, displayIds, {
      kind: "pull_request",
      owner: rp.owner,
      repo: rp.repo,
      pullNumber: Number(prNum),
      headRef,
      htmlUrl: pr.html_url ?? `https://github.com/${rp.owner}/${rp.repo}/pull/${prNum}`,
      title: pr.title ?? "",
      state: pr.merged ? "closed" : pr.state ?? "open",
      merged: Boolean(pr.merged),
      source: "webhook",
    });
    return { ok: true, status: 200 };
  }

  if (ev === "push") {
    const p = json as unknown as PushPayload;
    const fullName = p.repository?.full_name;
    const allowed = await repoFullNameAllowedForOrg(organizationId, fullName ?? "");
    if (!allowed) return { ok: true, status: 200 };
    const rp = repoParts(fullName, p.repository as { owner?: { login?: string }; name?: string });
    if (!rp || !p.ref?.startsWith("refs/heads/")) return { ok: true, status: 200 };
    const headRef = p.ref.replace(/^refs\/heads\//, "");
    const displayIds = await collectDisplayIdsForGithubPayload(organizationId, [headRef], fullName ?? "");
    if (displayIds.length === 0) return { ok: true, status: 200 };
    const compareUrl = `https://github.com/${rp.owner}/${rp.repo}/tree/${encodeURIComponent(headRef)}`;
    await upsertGithubLinksForIssues(organizationId, displayIds, {
      kind: "branch",
      owner: rp.owner,
      repo: rp.repo,
      pullNumber: null,
      headRef,
      htmlUrl: compareUrl,
      title: headRef,
      state: "active",
      merged: false,
      source: "webhook",
    });
    return { ok: true, status: 200 };
  }

  return { ok: true, status: 200 };
}
