import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { Issue } from "../models/Issue";
import { Project } from "../models/Project";
import { resolveDisplayIdsFromText } from "../utils/githubIssueKey";

export type GithubLinkLean = {
  id: string;
  kind: "pull_request" | "branch";
  owner: string;
  repo: string;
  pullNumber: number | null;
  headRef: string;
  htmlUrl: string;
  title: string;
  state: string;
  merged: boolean;
  source: "webhook" | "manual";
  updatedAt: Date;
};

export async function keyPrefixesForOrganization(organizationId: mongoose.Types.ObjectId): Promise<string[]> {
  const rows = await Project.find({ organizationId }).select("keyPrefix").lean();
  return [...new Set(rows.map((r) => r.keyPrefix).filter(Boolean))];
}

export async function repoFullNameAllowedForOrg(
  organizationId: mongoose.Types.ObjectId,
  repoFullName: string,
): Promise<boolean> {
  const normalized = repoFullName.trim().toLowerCase().replace(/\.git$/i, "");
  if (!normalized) return false;
  /** GitHub `full_name` has no `.git`; users sometimes save `owner/repo.git`. */
  const hit = await Project.findOne({
    organizationId,
    githubRepoFullName: { $regex: new RegExp(`^${escapeRegex(normalized)}(\\.git)?$`, "i") },
  })
    .select("_id")
    .lean();
  return Boolean(hit);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function prDedupeKey(owner: string, repo: string, pullNumber: number): string {
  return `pr:${owner.toLowerCase()}/${repo.toLowerCase()}#${pullNumber}`;
}

function branchDedupeKey(owner: string, repo: string, headRef: string): string {
  return `br:${owner.toLowerCase()}/${repo.toLowerCase()}@${headRef}`;
}

function linkDedupeId(link: GithubLinkLean): string {
  if (link.kind === "pull_request" && link.pullNumber != null) {
    return prDedupeKey(link.owner, link.repo, link.pullNumber);
  }
  return branchDedupeKey(link.owner, link.repo, link.headRef);
}

export async function upsertGithubLinksForIssues(
  organizationId: mongoose.Types.ObjectId,
  displayIds: string[],
  newLinks: Omit<GithubLinkLean, "id" | "updatedAt"> & { id?: string },
): Promise<void> {
  if (displayIds.length === 0) return;
  const now = new Date();
  const base: GithubLinkLean = {
    id: newLinks.id ?? randomUUID(),
    kind: newLinks.kind,
    owner: newLinks.owner,
    repo: newLinks.repo,
    pullNumber: newLinks.pullNumber,
    headRef: newLinks.headRef ?? "",
    htmlUrl: newLinks.htmlUrl,
    title: newLinks.title ?? "",
    state: newLinks.state ?? "open",
    merged: newLinks.merged ?? false,
    source: newLinks.source,
    updatedAt: now,
  };
  const dedupe = linkDedupeId(base);

  for (const displayId of displayIds) {
    const issue = await Issue.findOne({
      organizationId,
      displayId: new RegExp(`^${escapeRegex(displayId)}$`, "i"),
    });
    if (!issue) continue;
    const links = (issue.githubLinks ?? []) as unknown as GithubLinkLean[];
    const filtered = links.filter((l) => linkDedupeId(l) !== dedupe);
    if (base.kind === "pull_request") {
      const withoutBranchSameHead = filtered.filter((l) => {
        if (l.kind !== "branch") return true;
        return branchDedupeKey(l.owner, l.repo, l.headRef) !== branchDedupeKey(base.owner, base.repo, base.headRef);
      });
      issue.githubLinks = [...withoutBranchSameHead, base] as unknown as typeof issue.githubLinks;
    } else {
      issue.githubLinks = [...filtered, base] as unknown as typeof issue.githubLinks;
    }
    issue.updatedAt = now;
    await issue.save();
  }
}

export async function collectDisplayIdsForGithubPayload(
  organizationId: mongoose.Types.ObjectId,
  parts: string[],
): Promise<string[]> {
  const prefixes = await keyPrefixesForOrganization(organizationId);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const text of parts) {
    for (const id of resolveDisplayIdsFromText(text, prefixes)) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}
