import mongoose from "mongoose";
import { HttpError } from "../middleware/errorHandler";
import { Membership } from "../models/Membership";
import { Issue } from "../models/Issue";
import { Project } from "../models/Project";
import { User } from "../models/User";
import type { BoardColumnDto } from "../utils/boardColumns";
import { effectiveProjectBoardColumns } from "../utils/boardColumns";
import { normalizeGithubRepoFullNameInput } from "../utils/githubUrlParse";
import { LIMITS, assertMaxLength } from "../utils/inputLimits";
import { keyPrefixFromName, slugifyName } from "../utils/slug";

const COLORS = ["bg-indigo-500", "bg-purple-500", "bg-blue-500", "bg-emerald-500", "bg-rose-500"];

export type ProjectCardDto = {
  slug: string;
  name: string;
  status: string;
  members: number;
  progress: number;
  color: string;
  githubRepoFullName: string;
};

export type ProjectMemberDto = { id: string; name: string; initials: string };

export type ProjectDetailDto = {
  id: string;
  slug: string;
  name: string;
  keyPrefix: string;
  /** Linked GitHub repo `owner/name` for PR webhooks (empty if unset). */
  githubRepoFullName: string;
  memberCount: number;
  issueCount: number;
  members: ProjectMemberDto[];
  boardColumns: BoardColumnDto[];
};

function toCard(p: {
  slug: string;
  name: string;
  status: string;
  memberIds: unknown[];
  progress: number;
  color: string;
  githubRepoFullName?: string;
}): ProjectCardDto {
  const gh = typeof p.githubRepoFullName === "string" && p.githubRepoFullName.trim() ? p.githubRepoFullName.trim().toLowerCase() : "";
  return {
    slug: p.slug,
    name: p.name,
    status: p.status,
    members: p.memberIds.length,
    progress: p.progress,
    color: p.color,
    githubRepoFullName: gh,
  };
}

const REPO_FULL_NAME = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

export async function listProjects(organizationId: mongoose.Types.ObjectId, userId: string): Promise<ProjectCardDto[]> {
  const uid = new mongoose.Types.ObjectId(userId);
  const list = await Project.find({ organizationId, memberIds: uid }).sort({ name: 1 }).lean();
  return list.map(toCard);
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

async function findFreeSlug(organizationId: mongoose.Types.ObjectId, base: string): Promise<string> {
  let slug = base;
  let n = 0;
  while (await Project.exists({ organizationId, slug })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

async function findFreeKeyPrefix(organizationId: mongoose.Types.ObjectId, name: string): Promise<string> {
  const base = keyPrefixFromName(name);
  let keyPrefix = base;
  let suffix = 0;
  while (await Project.exists({ organizationId, keyPrefix })) {
    suffix += 1;
    keyPrefix = `${base.slice(0, 2)}${suffix}`;
  }
  return keyPrefix;
}

/** Retries when a concurrent create claims the same slug or key prefix (unique indexes). */
const CREATE_PROJECT_MAX_ATTEMPTS = 10;

/** Random back-off so colliding requests stop picking the same candidate in lockstep. */
function retryJitter(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5 + Math.floor(Math.random() * 45)));
}

export async function createProject(organizationId: mongoose.Types.ObjectId, userId: string, nameRaw: string): Promise<ProjectCardDto> {
  const name = nameRaw.trim();
  if (!name) throw new HttpError(400, "Invalid input");
  assertMaxLength(name, LIMITS.name, "Project name");
  const uid = new mongoose.Types.ObjectId(userId);
  const memberships = await Membership.find({ organizationId }).select("userId").lean();
  let memberIds = memberships.map((m) => m.userId as mongoose.Types.ObjectId);
  if (!memberIds.some((id) => id.equals(uid))) {
    memberIds = [...memberIds, uid];
  }

  for (let attempt = 1; ; attempt += 1) {
    const slug = await findFreeSlug(organizationId, slugifyName(name));
    const keyPrefix = await findFreeKeyPrefix(organizationId, name);
    const count = await Project.countDocuments({ organizationId });
    let p;
    try {
      p = await Project.create({
        organizationId,
        slug,
        name,
        keyPrefix,
        color: COLORS[count % COLORS.length],
        status: "Active",
        progress: 0,
        memberIds,
      });
    } catch (err) {
      if (isDuplicateKeyError(err) && attempt < CREATE_PROJECT_MAX_ATTEMPTS) {
        await retryJitter();
        continue;
      }
      if (isDuplicateKeyError(err)) throw new HttpError(409, "Project name is busy, please try again");
      throw err;
    }

    if (process.env.SKIP_STARTER_ISSUES !== "true") {
      await createStarterIssues(organizationId, p._id, keyPrefix, uid);
    }
    return toCard(p.toObject());
  }
}

const STARTER_ISSUES: {
  number: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  label: string;
  sortOrder: number;
}[] = [
  {
    number: 1,
    title: "Use the board and list views",
    description:
      "Switch between Board and List using the tabs above. Drag cards on the board to change status, or use the list tabs (Active, Backlog, Priority) to focus your work.",
    status: "todo",
    priority: "high",
    label: "Getting started",
    sortOrder: 0,
  },
  {
    number: 2,
    title: "Track priorities as you go",
    description:
      "Each issue has a priority (urgent, high, medium, low). Open the Priority tab in list view to sort everything by importance.",
    status: "in-progress",
    priority: "medium",
    label: "Getting started",
    sortOrder: 1,
  },
  {
    number: 3,
    title: "Ideas parked for later",
    description: "Use Backlog for work you have not started. Move issues here from the board when you want to defer them.",
    status: "backlog",
    priority: "low",
    label: "Getting started",
    sortOrder: 2,
  },
];

async function createStarterIssues(
  organizationId: mongoose.Types.ObjectId,
  projectId: mongoose.Types.ObjectId,
  keyPrefix: string,
  assigneeId: mongoose.Types.ObjectId,
) {
  for (const row of STARTER_ISSUES) {
    const displayId = `${keyPrefix}-${row.number}`;
    await Issue.create({
      organizationId,
      projectId,
      displayId,
      number: row.number,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      assigneeId,
      label: row.label,
      unread: false,
      sortOrder: row.sortOrder,
      attachments: [],
    });
  }
}

export async function getProjectBySlug(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  slug: string,
): Promise<ProjectDetailDto> {
  const uid = new mongoose.Types.ObjectId(userId);
  const p = await Project.findOne({ organizationId, slug }).lean();
  if (!p || !p.memberIds.some((m) => m.equals(uid))) throw new HttpError(404, "Project not found");
  const issueCount = await Issue.countDocuments({ organizationId, projectId: p._id });
  const memberUsers = await User.find({ _id: { $in: p.memberIds } })
    .select("name initials")
    .lean();
  const members: ProjectMemberDto[] = memberUsers.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    initials: u.initials,
  }));
  const ghRaw = (p as unknown as { githubRepoFullName?: string }).githubRepoFullName;
  const githubRepoFullName = typeof ghRaw === "string" && ghRaw.trim() ? ghRaw.trim().toLowerCase() : "";
  return {
    id: p._id.toString(),
    slug: p.slug,
    name: p.name,
    keyPrefix: p.keyPrefix,
    githubRepoFullName,
    memberCount: p.memberIds.length,
    issueCount,
    members,
    boardColumns: effectiveProjectBoardColumns(p),
  };
}

export async function patchProjectBoardColumns(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  membershipRole: "owner" | "admin" | "member",
  slug: string,
  boardColumns: BoardColumnDto[],
): Promise<ProjectDetailDto> {
  if (membershipRole !== "owner" && membershipRole !== "admin") {
    throw new HttpError(403, "Forbidden");
  }
  const uid = new mongoose.Types.ObjectId(userId);
  const p = await Project.findOne({ organizationId, slug });
  if (!p || !p.memberIds.some((m) => m.equals(uid))) throw new HttpError(404, "Project not found");
  p.set("boardColumns", boardColumns);
  await p.save();
  return getProjectBySlug(organizationId, userId, slug);
}

export async function assertProjectMember(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  slug: string,
) {
  const uid = new mongoose.Types.ObjectId(userId);
  const p = await Project.findOne({ organizationId, slug }).lean();
  if (!p || !p.memberIds.some((m) => m.equals(uid))) throw new HttpError(404, "Project not found");
  return p;
}

export async function patchProjectGithubRepo(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  membershipRole: "owner" | "admin" | "member",
  slug: string,
  githubRepoFullNameRaw: string | null | undefined,
): Promise<ProjectDetailDto> {
  if (membershipRole !== "owner" && membershipRole !== "admin") {
    throw new HttpError(403, "Only owners and admins can manage GitHub linking");
  }
  const p = await assertProjectMember(organizationId, userId, slug);
  let value = "";
  if (githubRepoFullNameRaw != null && String(githubRepoFullNameRaw).trim()) {
    value = normalizeGithubRepoFullNameInput(String(githubRepoFullNameRaw));
    if (!REPO_FULL_NAME.test(value)) throw new HttpError(400, "Invalid repo (use owner/repo or a GitHub repo URL)");
  }
  await Project.updateOne({ _id: p._id }, { $set: { githubRepoFullName: value } });
  return getProjectBySlug(organizationId, userId, slug);
}