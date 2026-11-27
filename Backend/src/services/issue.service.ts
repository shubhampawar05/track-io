import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { HttpError } from "../middleware/errorHandler";
import { Comment } from "../models/Comment";
import { Issue } from "../models/Issue";
import type { IssueDoc } from "../models/Issue";
import { Project } from "../models/Project";
import { User } from "../models/User";
import { formatRelative } from "../utils/formatRelative";
import { deleteAttachmentFromGridFs, getAttachmentFileMeta } from "./attachmentStorage.service";
import { attachmentGridFsIdFromTrustedUrl, isTrustedUploadUrl } from "../utils/uploadUrl";
import { assertProjectMember } from "./project.service";
import { isValidStatusSlug } from "../utils/boardColumns";

type Priority = "low" | "medium" | "high" | "urgent" | "none";

const PRIORITY_SET = new Set<Priority>(["low", "medium", "high", "urgent", "none"]);

const ISSUE_LABELS = [
  "General",
  "Bug",
  "Feature",
  "Improvement",
  "Docs",
  "Chore",
] as const;
const ISSUE_LABEL_SET = new Set<string>(ISSUE_LABELS);

const PRIORITY_FOR_NIN = ["urgent", "high", "medium", "low"] as const;

export type IssueListQueryParams = {
  status: string[];
  priority: string[];
  label: string[];
  assignee: string[];
};

function firstQueryValue(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) return firstQueryValue(v[0]);
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

export function parseIssueListQueryParams(
  raw: Record<string, unknown>,
): IssueListQueryParams {
  const csv = (key: string) =>
    (firstQueryValue(raw[key]) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const statuses: string[] = [];
  for (const t of csv("status")) {
    const n = normalizeIssueStatusFilterToken(t);
    if (n) statuses.push(n);
  }

  const priority = csv("priority")
    .map((p) => p.toLowerCase().trim())
    .filter(Boolean);

  const labels: string[] = [];
  for (const l of csv("label")) {
    const trimmed = l.trim();
    if (ISSUE_LABEL_SET.has(trimmed)) labels.push(trimmed);
  }

  const assignee = csv("assignee")
    .map((a) => a.trim())
    .filter(Boolean);

  return { status: statuses, priority, label: labels, assignee };
}

function normalizeIssueStatusFilterToken(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/_/g, "-");
  if (s === "inprogress") return "in-progress";
  if (s === "cancelled") return "canceled";
  if (isValidStatusSlug(s)) return s;
  return null;
}

function buildIssueListFilterParts(
  query: IssueListQueryParams | undefined,
  userId: string,
): Record<string, unknown>[] {
  if (!query) return [];
  const parts: Record<string, unknown>[] = [];
  if (query.status.length > 0) {
    parts.push({ status: { $in: query.status } });
  }
  if (query.label.length > 0) {
    parts.push({ label: { $in: query.label } });
  }
  const pPart = buildPriorityFilterPart(query.priority);
  if (pPart) parts.push(pPart);
  const aPart = buildAssigneeFilterPart(query.assignee, userId);
  if (aPart) parts.push(aPart);
  return parts;
}

function buildPriorityFilterPart(
  tokens: string[],
): Record<string, unknown> | null {
  const lower = tokens.map((t) => t.toLowerCase().trim());
  const hasNone = lower.includes("none") || lower.includes("no-priority");
  const known = lower.filter((t): t is Priority =>
    PRIORITY_SET.has(t as Priority),
  );
  if (!hasNone && known.length === 0) return null;
  if (!hasNone) return { priority: { $in: known } };
  const noneBranch = { priority: { $nin: [...PRIORITY_FOR_NIN] } };
  if (known.length === 0) return noneBranch;
  return { $or: [{ priority: { $in: known } }, noneBranch] };
}

function buildAssigneeFilterPart(
  tokens: string[],
  userId: string,
): Record<string, unknown> | null {
  if (tokens.length === 0) return null;
  const lower = tokens.map((t) => t.toLowerCase());
  const hasUnassigned = lower.includes("unassigned");
  const hasMe = lower.includes("me");
  const oidList: mongoose.Types.ObjectId[] = [];
  for (const t of tokens) {
    const tl = t.toLowerCase();
    if (tl === "unassigned" || tl === "me") continue;
    if (mongoose.isValidObjectId(t))
      oidList.push(new mongoose.Types.ObjectId(t));
  }
  if (hasMe) oidList.push(new mongoose.Types.ObjectId(userId));
  const uniq = [...new Map(oidList.map((id) => [id.toString(), id])).values()];

  if (hasUnassigned && uniq.length === 0) {
    return { assigneeId: null };
  }
  if (!hasUnassigned && uniq.length > 0) {
    return { assigneeId: { $in: uniq } };
  }
  if (hasUnassigned && uniq.length > 0) {
    return { $or: [{ assigneeId: null }, { assigneeId: { $in: uniq } }] };
  }
  return null;
}

function coalesceIssuePriority(raw: unknown): Priority {
  const s = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  if (PRIORITY_SET.has(s as Priority)) return s as Priority;
  return "medium";
}

/** Reject invalid client input; omit/empty falls back to default for creates. */
function resolveCreatePriority(raw: unknown | undefined): Priority {
  if (raw === undefined || raw === null || raw === "") return "medium";
  if (typeof raw !== "string") throw new HttpError(400, "Invalid priority");
  const s = raw.toLowerCase().trim();
  if (!PRIORITY_SET.has(s as Priority))
    throw new HttpError(400, "Invalid priority");
  return s as Priority;
}

function normalizeLabelFromDb(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (ISSUE_LABEL_SET.has(s)) return s;
  return "General";
}

function resolveCreateLabel(raw: unknown | undefined): string {
  if (raw === undefined || raw === null || raw === "") return "General";
  const s = String(raw).trim();
  if (!ISSUE_LABEL_SET.has(s)) throw new HttpError(400, "Invalid label");
  return s;
}

function applyLabelPatch(
  issue: { set: (path: string, val: unknown) => void },
  body: Record<string, unknown>,
) {
  if (!("label" in body)) return;
  if (body.label === undefined) return;
  if (body.label === null || body.label === "") {
    issue.set("label", "General");
    return;
  }
  if (typeof body.label !== "string") throw new HttpError(400, "Invalid label");
  const s = body.label.trim();
  if (!ISSUE_LABEL_SET.has(s)) throw new HttpError(400, "Invalid label");
  issue.set("label", s);
}

const MAX_COMMENT_ATTACHMENTS = 8;
const MAX_ISSUE_ATTACHMENTS = 20;

function normalizeAttachmentsInput(raw: unknown): {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  url: string;
}[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new HttpError(400, "Invalid attachments");
  if (raw.length > MAX_COMMENT_ATTACHMENTS)
    throw new HttpError(400, "Too many attachments");
  const out: {
    id: string;
    filename: string;
    size: number;
    mimeType: string;
    url: string;
  }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object")
      throw new HttpError(400, "Invalid attachment");
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "").trim();
    const filename = String(o.filename ?? "")
      .trim()
      .slice(0, 256);
    const url = String(o.url ?? "").trim();
    const mimeType = String(o.mimeType ?? "application/octet-stream").slice(
      0,
      128,
    );
    const size = typeof o.size === "number" && o.size >= 0 ? o.size : 0;
    if (!id || !filename || !url)
      throw new HttpError(400, "Invalid attachment");
    if (!isTrustedUploadUrl(url))
      throw new HttpError(400, "Invalid attachment URL");
    out.push({ id, filename, size, mimeType, url });
  }
  return out;
}

/**
 * Upload URLs only prove a file lives in this API's GridFS bucket, not who owns it.
 * Reject any file that was not uploaded into the caller's organization.
 */
async function assertAttachmentUrlsOwnedByOrganization(
  organizationId: mongoose.Types.ObjectId,
  urls: string[],
): Promise<void> {
  for (const url of urls) {
    const gridId = attachmentGridFsIdFromTrustedUrl(url);
    if (!gridId) throw new HttpError(400, "Invalid attachment URL");
    const meta = await getAttachmentFileMeta(gridId);
    if (!meta || !meta.organizationId.equals(organizationId)) {
      throw new HttpError(400, "Invalid attachment URL");
    }
  }
}

/** True when the URL is still attached to any issue or comment in the organization. */
async function isAttachmentUrlStillReferenced(
  organizationId: mongoose.Types.ObjectId,
  url: string,
): Promise<boolean> {
  const [onIssue, onComment] = await Promise.all([
    Issue.exists({ organizationId, "attachments.url": url }),
    Comment.exists({ organizationId, "attachments.url": url }),
  ]);
  return Boolean(onIssue || onComment);
}

export type GithubLinkDto = {
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
  updatedAt: string;
};

export type IssueListDto = {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: Priority;
  label: string;
  assignee: string;
  /** Full name for tooltips; null when unassigned or unknown */
  assigneeName: string | null;
  date: string;
  /** Order within the same `status` (0-based). Used by board / list ordering. */
  sortOrder: number;
  projectId?: string;
  /** Count of linked GitHub PRs/branches (optional UI hint). */
  githubLinkCount?: number;
};

export type IssueCommentDto = {
  id: string;
  authorUserId: string;
  authorName: string;
  authorInitials: string;
  avatarSeed: string;
  timeLabel: string;
  body: string;
  attachments: IssueAttachmentDto[];
};

export type IssueAttachmentDto = {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  url: string;
};

export type IssueSubtaskDto = {
  id: string;
  title: string;
  done: boolean;
  linkedIssueId?: string | null;
  linkedAssigneeInitials?: string | null;
  linkedDueDate?: string | null;
};

export type IssueDetailDto = IssueListDto & {
  description: string;
  unread: boolean;
  comments: IssueCommentDto[];
  attachments: IssueAttachmentDto[];
  subtasks: IssueSubtaskDto[];
  githubLinks: GithubLinkDto[];
  projectSlug: string;
  projectName: string;
  assigneeId: string | null;
  assigneeInitials: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

async function loadUserMap(
  ids: mongoose.Types.ObjectId[],
): Promise<Map<string, { name: string; initials: string }>> {
  const uniq = [...new Set(ids.map((id) => id.toString()))];
  const objectIds = uniq.map((id) => new mongoose.Types.ObjectId(id));
  const users = await User.find({ _id: { $in: objectIds } })
    .select("name initials")
    .lean();
  return new Map(
    users.map((u) => [
      u._id.toString(),
      { name: u.name, initials: u.initials },
    ]),
  );
}

const BOARD_STATUS_RANK: string[] = [
  "backlog",
  "todo",
  "in-progress",
  "done",
  "canceled",
];

function statusRank(status: string): number {
  const i = BOARD_STATUS_RANK.indexOf(status);
  return i === -1 ? 1000 : i;
}

const MAX_SUBTASKS = 100;
const MAX_SUBTASK_TITLE = 500;

async function assertLinkedSubtasksAllowed(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  parentDisplayId: string,
  linkedIds: string[],
): Promise<void> {
  const uniq = [...new Set(linkedIds.filter(Boolean))];
  if (uniq.length === 0) return;
  const pids = await projectIdsForUser(organizationId, userId);
  const rows = await Issue.find({
    organizationId,
    displayId: { $in: uniq },
  })
    .select("displayId projectId")
    .lean();
  if (rows.length !== uniq.length)
    throw new HttpError(400, "Invalid linked issue");
  for (const row of rows) {
    if (!pids.some((pid) => pid.equals(row.projectId)))
      throw new HttpError(400, "Invalid linked issue");
    if (row.displayId === parentDisplayId)
      throw new HttpError(400, "Subtask cannot link to this issue");
  }
}

async function normalizeSubtasksPatch(
  raw: unknown,
  ctx: {
    organizationId: mongoose.Types.ObjectId;
    userId: string;
    parentDisplayId: string;
  },
): Promise<IssueSubtaskDto[]> {
  if (!Array.isArray(raw)) throw new HttpError(400, "Invalid subtasks");
  if (raw.length > MAX_SUBTASKS) throw new HttpError(400, "Too many subtasks");
  const out: IssueSubtaskDto[] = [];
  const linkedToValidate: string[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object")
      throw new HttpError(400, "Invalid subtasks");
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!id || !title) throw new HttpError(400, "Invalid subtask");
    if (title.length > MAX_SUBTASK_TITLE)
      throw new HttpError(400, "Subtask title too long");
    let linkedIssueId: string | null = null;
    if ("linkedIssueId" in o) {
      if (o.linkedIssueId === null || o.linkedIssueId === undefined) {
        linkedIssueId = null;
      } else if (typeof o.linkedIssueId === "string") {
        const s = o.linkedIssueId.trim();
        linkedIssueId = s ? s : null;
      } else {
        throw new HttpError(400, "Invalid subtasks");
      }
    }
    if (linkedIssueId) linkedToValidate.push(linkedIssueId);
    out.push({
      id,
      title,
      done: Boolean(o.done),
      linkedIssueId,
    });
  }
  await assertLinkedSubtasksAllowed(
    ctx.organizationId,
    ctx.userId,
    ctx.parentDisplayId,
    linkedToValidate,
  );
  return out;
}

async function enrichSubtasksForDetail(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  subtasks: IssueSubtaskDto[],
): Promise<IssueSubtaskDto[]> {
  const linkedIds = [
    ...new Set(
      subtasks
        .map((s) => s.linkedIssueId)
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  if (linkedIds.length === 0) return subtasks;

  const pids = await projectIdsForUser(organizationId, userId);
  const children = await Issue.find({
    organizationId,
    displayId: { $in: linkedIds },
  })
    .select("displayId projectId assigneeId dueDate")
    .lean();

  const accessible = children.filter((c) =>
    pids.some((pid) => pid.equals(c.projectId)),
  );
  const assigneeObjIds = accessible
    .map((c) => c.assigneeId)
    .filter(Boolean) as mongoose.Types.ObjectId[];
  const userMap = await loadUserMap(assigneeObjIds);
  const byDisplay = new Map(
    accessible.map((c) => {
      const initials = c.assigneeId
        ? (userMap.get(c.assigneeId.toString())?.initials ?? null)
        : null;
      const dueRaw = (c as unknown as { dueDate?: Date | null }).dueDate;
      const linkedDueDate =
        dueRaw && !Number.isNaN(new Date(dueRaw).getTime())
          ? new Date(dueRaw).toISOString()
          : null;
      return [c.displayId, { initials, linkedDueDate }] as const;
    }),
  );

  return subtasks.map((s) => {
    if (!s.linkedIssueId) return s;
    const meta = byDisplay.get(s.linkedIssueId);
    if (!meta) {
      return {
        ...s,
        linkedAssigneeInitials: null,
        linkedDueDate: null,
      };
    }
    return {
      ...s,
      linkedAssigneeInitials: meta.initials,
      linkedDueDate: meta.linkedDueDate,
    };
  });
}

function compareIssuesForBoardList(
  a: {
    status: string;
    sortOrder?: number;
    number: number;
    projectId?: mongoose.Types.ObjectId;
  },
  b: {
    status: string;
    sortOrder?: number;
    number: number;
    projectId?: mongoose.Types.ObjectId;
  },
  projectSlugById?: Map<string, string>,
): number {
  const sr = statusRank(a.status) - statusRank(b.status);
  if (sr !== 0) return sr;
  if (projectSlugById) {
    const sa = projectSlugById.get(a.projectId?.toString() ?? "") ?? "";
    const sb = projectSlugById.get(b.projectId?.toString() ?? "") ?? "";
    const pc = sa.localeCompare(sb);
    if (pc !== 0) return pc;
  }
  const oa = typeof a.sortOrder === "number" ? a.sortOrder : 0;
  const ob = typeof b.sortOrder === "number" ? b.sortOrder : 0;
  if (oa !== ob) return oa - ob;
  return a.number - b.number;
}

function mapGithubLinkDtos(raw: unknown): GithubLinkDto[] {
  if (!Array.isArray(raw)) return [];
  const out: GithubLinkDto[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "");
    const kind = o.kind === "branch" ? "branch" : "pull_request";
    const owner = String(o.owner ?? "");
    const repo = String(o.repo ?? "");
    if (!id || !owner || !repo) continue;
    const pullNumber = typeof o.pullNumber === "number" ? o.pullNumber : null;
    const headRef = String(o.headRef ?? "");
    const htmlUrl = String(o.htmlUrl ?? "");
    if (!htmlUrl) continue;
    const updatedAt =
      o.updatedAt instanceof Date
        ? o.updatedAt
        : new Date(String(o.updatedAt ?? Date.now()));
    out.push({
      id,
      kind,
      owner,
      repo,
      pullNumber,
      headRef,
      htmlUrl,
      title: String(o.title ?? ""),
      state: String(o.state ?? "open"),
      merged: Boolean(o.merged),
      source: o.source === "manual" ? "manual" : "webhook",
      updatedAt: updatedAt.toISOString(),
    });
  }
  return out;
}

async function toListDto(
  issue: IssueDoc,
  project: { slug: string; keyPrefix: string },
  userMap: Map<string, { name: string; initials: string }>,
): Promise<IssueListDto> {
  const assignee = issue.assigneeId
    ? userMap.get(issue.assigneeId.toString())
    : null;
  const updatedAt = issue.updatedAt ?? issue.createdAt ?? new Date();
  const so = typeof issue.sortOrder === "number" ? issue.sortOrder : 0;
  const gl = (issue as unknown as { githubLinks?: unknown[] }).githubLinks;
  return {
    id: issue.displayId,
    key: `${project.keyPrefix}-${issue.number}`,
    title: issue.title,
    status: issue.status,
    priority: coalesceIssuePriority(issue.priority),
    label: normalizeLabelFromDb(issue.label),
    assignee: assignee?.initials ?? "—",
    assigneeName: assignee?.name ?? null,
    date: formatRelative(new Date(updatedAt)),
    sortOrder: so,
    projectId: project.slug,
    githubLinkCount: Array.isArray(gl) ? gl.length : 0,
  };
}

type CommentLean = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  content: string;
  createdAt?: Date;
  attachments?: {
    id: string;
    filename: string;
    size: number;
    mimeType: string;
    url: string;
  }[];
};

async function toDetailDto(
  issue: IssueDoc,
  project: { slug: string; keyPrefix: string; name: string },
  userMap: Map<string, { name: string; initials: string }>,
  comments: CommentLean[],
  userId: string,
): Promise<IssueDetailDto> {
  const base = await toListDto(issue, project, userMap);
  const assignee = issue.assigneeId
    ? userMap.get(issue.assigneeId.toString())
    : null;
  const dueRaw = (issue as unknown as { dueDate?: Date | null }).dueDate;
  const commentDtos: IssueCommentDto[] = comments.map((c) => {
    const u = userMap.get(c.userId.toString());
    const created = c.createdAt ?? new Date();
    const ca = (c.attachments ?? []).map((a) => ({
      id: a.id,
      filename: a.filename,
      size: a.size,
      mimeType: a.mimeType,
      url: a.url,
    }));
    return {
      id: c._id.toString(),
      authorUserId: c.userId.toString(),
      authorName: u?.name ?? "Unknown",
      authorInitials: u?.initials ?? "?",
      avatarSeed: u?.name ?? "user",
      timeLabel: formatRelative(new Date(created)),
      body: c.content,
      attachments: ca,
    };
  });
  const attachments: IssueAttachmentDto[] = (issue.attachments ?? []).map(
    (a) => ({
      id: a.id,
      filename: a.filename,
      size: a.size,
      mimeType: a.mimeType,
      url: a.url,
    }),
  );
  const rawSubtasks = (issue as unknown as { subtasks?: unknown[] }).subtasks;
  const orgId = (
    issue as unknown as { organizationId: mongoose.Types.ObjectId }
  ).organizationId;
  const subtasksBase: IssueSubtaskDto[] = Array.isArray(rawSubtasks)
    ? rawSubtasks.map((row) => {
        const s = row as Record<string, unknown>;
        const rawLinked = s.linkedIssueId;
        const linkedIssueId =
          typeof rawLinked === "string" && rawLinked.trim()
            ? rawLinked.trim()
            : null;
        return {
          id: String(s.id),
          title: String(s.title),
          done: Boolean(s.done),
          linkedIssueId,
        };
      })
    : [];
  const subtasks = await enrichSubtasksForDetail(orgId, userId, subtasksBase);
  const createdAt = issue.createdAt ?? new Date();
  const updatedAt = issue.updatedAt ?? createdAt;
  return {
    ...base,
    description: issue.description,
    unread: issue.unread,
    comments: commentDtos,
    attachments,
    subtasks,
    githubLinks: mapGithubLinkDtos(
      (issue as unknown as { githubLinks?: unknown }).githubLinks,
    ),
    projectSlug: project.slug,
    projectName: project.name,
    assigneeId: issue.assigneeId ? issue.assigneeId.toString() : null,
    assigneeName: assignee?.name ?? null,
    assigneeInitials: assignee?.initials ?? null,
    dueDate: dueRaw ? new Date(dueRaw).toISOString() : null,
    createdAt: new Date(createdAt).toISOString(),
    updatedAt: new Date(updatedAt).toISOString(),
  };
}

async function projectIdsForUser(
  orgId: mongoose.Types.ObjectId,
  userId: string,
): Promise<mongoose.Types.ObjectId[]> {
  const uid = new mongoose.Types.ObjectId(userId);
  const projects = await Project.find({ organizationId: orgId, memberIds: uid })
    .select("_id")
    .lean();
  return projects.map((p) => p._id);
}

export async function listAllIssues(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  query?: IssueListQueryParams,
): Promise<IssueListDto[]> {
  const pids = await projectIdsForUser(organizationId, userId);
  if (pids.length === 0) return [];
  const filterParts: Record<string, unknown>[] = [
    { organizationId },
    { projectId: { $in: pids } },
    ...buildIssueListFilterParts(query, userId),
  ];
  const filter =
    filterParts.length === 1 ? filterParts[0]! : { $and: filterParts };
  const rows = await Issue.find(filter).limit(200).lean();
  const projects = await Project.find({
    _id: { $in: rows.map((r) => r.projectId) },
  })
    .select("slug keyPrefix")
    .lean();
  const projMap = new Map(projects.map((p) => [p._id.toString(), p]));
  const slugByProjectId = new Map(
    projects.map((p) => [p._id.toString(), p.slug]),
  );
  rows.sort((a, b) => compareIssuesForBoardList(a, b, slugByProjectId));
  const userIds = rows
    .map((r) => r.assigneeId)
    .filter(Boolean) as mongoose.Types.ObjectId[];
  const userMap = await loadUserMap(userIds);
  const out: IssueListDto[] = [];
  for (const row of rows) {
    const p = projMap.get(row.projectId.toString());
    if (!p) continue;
    out.push(await toListDto(row as unknown as IssueDoc, p, userMap));
  }
  return out;
}

export async function listProjectIssues(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  slug: string,
  query?: IssueListQueryParams,
): Promise<IssueListDto[]> {
  const p = await assertProjectMember(organizationId, userId, slug);
  const filterParts: Record<string, unknown>[] = [
    { organizationId },
    { projectId: p._id },
    ...buildIssueListFilterParts(query, userId),
  ];
  const filter =
    filterParts.length === 1 ? filterParts[0]! : { $and: filterParts };
  const rows = await Issue.find(filter).lean();
  rows.sort((a, b) => compareIssuesForBoardList(a, b));
  const userIds = rows
    .map((r) => r.assigneeId)
    .filter(Boolean) as mongoose.Types.ObjectId[];
  const userMap = await loadUserMap(userIds);
  const proj = { slug: p.slug, keyPrefix: p.keyPrefix };
  const out: IssueListDto[] = [];
  for (const row of rows) {
    out.push(await toListDto(row as unknown as IssueDoc, proj, userMap));
  }
  return out;
}

async function loadIssueForUser(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  displayId: string,
): Promise<{
  issue: IssueDoc;
  project: {
    slug: string;
    keyPrefix: string;
    name: string;
    memberIds: mongoose.Types.ObjectId[];
  };
}> {
  const issue = await Issue.findOne({ organizationId, displayId }).lean();
  if (!issue) throw new HttpError(404, "Issue not found");
  const project = await Project.findById(issue.projectId).lean();
  if (!project || !project.organizationId.equals(organizationId))
    throw new HttpError(404, "Issue not found");
  const uid = new mongoose.Types.ObjectId(userId);
  if (!project.memberIds.some((m) => m.equals(uid)))
    throw new HttpError(403, "Forbidden");
  return {
    issue: issue as unknown as IssueDoc,
    project: {
      slug: project.slug,
      keyPrefix: project.keyPrefix,
      name: project.name,
      memberIds: project.memberIds as mongoose.Types.ObjectId[],
    },
  };
}

export async function getIssueDetail(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  displayId: string,
): Promise<IssueDetailDto> {
  const { issue, project } = await loadIssueForUser(
    organizationId,
    userId,
    displayId,
  );
  const issueId = (issue as unknown as { _id: mongoose.Types.ObjectId })._id;
  const comments = await Comment.find({ issueId })
    .sort({ createdAt: 1 })
    .lean();
  const userIds = [issue.assigneeId, ...comments.map((c) => c.userId)].filter(
    Boolean,
  ) as mongoose.Types.ObjectId[];
  const userMap = await loadUserMap(userIds);
  return toDetailDto(
    issue as unknown as IssueDoc,
    project,
    userMap,
    comments as CommentLean[],
    userId,
  );
}

export async function patchIssue(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  displayId: string,
  body: Record<string, unknown>,
): Promise<IssueDetailDto> {
  const { project: projMeta } = await loadIssueForUser(
    organizationId,
    userId,
    displayId,
  );
  const issue = await Issue.findOne({ organizationId, displayId });
  if (!issue) throw new HttpError(404, "Issue not found");
  if (typeof body.title === "string") issue.title = body.title.trim();
  if (typeof body.description === "string")
    issue.description = body.description;
  if (typeof body.status === "string") issue.status = body.status;
  if (typeof body.priority === "string")
    issue.priority = resolveCreatePriority(body.priority);
  if (typeof body.unread === "boolean") issue.unread = body.unread;
  if (typeof body.sortOrder === "number") issue.sortOrder = body.sortOrder;
  applyLabelPatch(issue, body);
  if (body.assigneeId === null) issue.assigneeId = null;
  if (
    typeof body.assigneeId === "string" &&
    mongoose.Types.ObjectId.isValid(body.assigneeId)
  ) {
    const aid = new mongoose.Types.ObjectId(body.assigneeId);
    if (!projMeta.memberIds.some((m) => m.equals(aid)))
      throw new HttpError(400, "Assignee must be a project member");
    issue.assigneeId = aid;
  }
  if (body.dueDate === null || body.dueDate === "") {
    issue.set("dueDate", null);
  } else if (typeof body.dueDate === "string") {
    const d = new Date(body.dueDate);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, "Invalid due date");
    issue.set("dueDate", d);
  }
  if (body.subtasks !== undefined) {
    issue.set(
      "subtasks",
      await normalizeSubtasksPatch(body.subtasks, {
        organizationId,
        userId,
        parentDisplayId: displayId,
      }),
    );
  }
  await issue.save();
  return getIssueDetail(organizationId, userId, displayId);
}

export async function patchIssueUnderProject(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  slug: string,
  displayId: string,
  body: Record<string, unknown>,
): Promise<IssueListDto> {
  const p = await assertProjectMember(organizationId, userId, slug);
  const issue = await Issue.findOne({
    organizationId,
    projectId: p._id,
    displayId,
  });
  if (!issue) throw new HttpError(404, "Issue not found");
  if (typeof body.title === "string") issue.title = body.title.trim();
  if (typeof body.description === "string")
    issue.description = body.description;
  if (typeof body.status === "string") issue.status = body.status;
  if (typeof body.priority === "string")
    issue.priority = resolveCreatePriority(body.priority);
  if (typeof body.unread === "boolean") issue.unread = body.unread;
  if (typeof body.sortOrder === "number") issue.sortOrder = body.sortOrder;
  applyLabelPatch(issue, body);
  if (body.assigneeId === null) issue.assigneeId = null;
  if (
    typeof body.assigneeId === "string" &&
    mongoose.Types.ObjectId.isValid(body.assigneeId)
  ) {
    const aid = new mongoose.Types.ObjectId(body.assigneeId);
    if (!p.memberIds.some((m) => m.equals(aid)))
      throw new HttpError(400, "Assignee must be a project member");
    issue.assigneeId = aid;
  }
  if (body.dueDate === null || body.dueDate === "") {
    issue.set("dueDate", null);
  } else if (typeof body.dueDate === "string") {
    const d = new Date(body.dueDate);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, "Invalid due date");
    issue.set("dueDate", d);
  }
  if (body.subtasks !== undefined) {
    issue.set(
      "subtasks",
      await normalizeSubtasksPatch(body.subtasks, {
        organizationId,
        userId,
        parentDisplayId: displayId,
      }),
    );
  }
  await issue.save();
  const userMap = await loadUserMap(issue.assigneeId ? [issue.assigneeId] : []);
  return toListDto(
    issue.toObject() as IssueDoc,
    { slug: p.slug, keyPrefix: p.keyPrefix },
    userMap,
  );
}

async function nextIssueNumber(
  projectId: mongoose.Types.ObjectId,
): Promise<number> {
  const last = await Issue.findOne({ projectId })
    .sort({ number: -1 })
    .select("number")
    .lean();
  return last ? last.number + 1 : 1;
}

function resolveCreateAssigneeId(
  inputAssignee: string | null | undefined,
  memberIds: mongoose.Types.ObjectId[],
  creatorId: mongoose.Types.ObjectId,
): mongoose.Types.ObjectId | null {
  if (inputAssignee === null) return null;
  if (inputAssignee === undefined || inputAssignee === "") return creatorId;
  if (!mongoose.Types.ObjectId.isValid(inputAssignee))
    throw new HttpError(400, "Invalid assignee");
  const aid = new mongoose.Types.ObjectId(inputAssignee);
  if (!memberIds.some((m) => m.equals(aid)))
    throw new HttpError(400, "Assignee must be a project member");
  return aid;
}

export async function createIssueUnderProject(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  slug: string,
  input: {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    label?: string;
    assigneeId?: string | null;
    dueDate?: string | null;
  },
): Promise<IssueListDto> {
  const p = await assertProjectMember(organizationId, userId, slug);
  const title = input.title.trim();
  if (!title) throw new HttpError(400, "Invalid input");
  const number = await nextIssueNumber(p._id);
  const displayId = `${p.keyPrefix}-${number}`;
  const uid = new mongoose.Types.ObjectId(userId);
  const assigneeId = resolveCreateAssigneeId(
    input.assigneeId,
    p.memberIds as mongoose.Types.ObjectId[],
    uid,
  );
  const sortOrder = await Issue.countDocuments({ projectId: p._id });
  let dueDate: Date | null = null;
  if (input.dueDate === null || input.dueDate === "") {
    dueDate = null;
  } else if (typeof input.dueDate === "string") {
    const d = new Date(input.dueDate);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, "Invalid due date");
    dueDate = d;
  }
  const issue = await Issue.create({
    organizationId,
    projectId: p._id,
    displayId,
    number,
    title,
    description: String(input.description ?? "").trim(),
    status: input.status ?? "todo",
    priority: resolveCreatePriority(input.priority),
    assigneeId,
    label: resolveCreateLabel(input.label),
    unread: false,
    sortOrder,
    attachments: [],
    dueDate,
    subtasks: [],
  });
  const userMap = await loadUserMap(assigneeId ? [assigneeId] : []);
  return toListDto(
    issue.toObject() as IssueDoc,
    { slug: p.slug, keyPrefix: p.keyPrefix },
    userMap,
  );
}

export async function createIssueGlobal(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  input: {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    label?: string;
    projectSlug?: string | null;
    assigneeId?: string | null;
    dueDate?: string | null;
  },
): Promise<IssueListDto> {
  const title = input.title.trim();
  if (!title) throw new HttpError(400, "Invalid input");
  let p;
  if (input.projectSlug) {
    p = await assertProjectMember(organizationId, userId, input.projectSlug);
  } else {
    const uid = new mongoose.Types.ObjectId(userId);
    p = await Project.findOne({ organizationId, memberIds: uid })
      .sort({ updatedAt: -1 })
      .lean();
    if (!p) throw new HttpError(400, "No project");
  }
  return createIssueUnderProject(organizationId, userId, p.slug, {
    title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    label: input.label,
    assigneeId: input.assigneeId,
    dueDate: input.dueDate,
  });
}

export async function deleteIssue(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  displayId: string,
  membershipRole: "owner" | "admin" | "member",
): Promise<void> {
  if (membershipRole !== "owner") {
    throw new HttpError(403, "Only the workspace owner can delete issues");
  }
  const { issue } = await loadIssueForUser(organizationId, userId, displayId);
  const subs = (issue as unknown as { subtasks?: unknown[] }).subtasks;
  if (Array.isArray(subs) && subs.length > 0) {
    throw new HttpError(400, "Remove all subtasks before deleting this issue");
  }
  const oid = (issue as unknown as { _id: mongoose.Types.ObjectId })._id;
  await Comment.deleteMany({ issueId: oid, organizationId });
  const del = await Issue.deleteOne({ _id: oid, organizationId });
  if (del.deletedCount === 0) throw new HttpError(404, "Issue not found");
}

export async function addComment(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  displayId: string,
  text: string,
  attachmentsRaw?: unknown,
): Promise<IssueDetailDto> {
  const content = text.trim();
  const attachments = normalizeAttachmentsInput(attachmentsRaw);
  if (!content && attachments.length === 0)
    throw new HttpError(400, "Invalid input");
  await loadIssueForUser(organizationId, userId, displayId);
  await assertAttachmentUrlsOwnedByOrganization(
    organizationId,
    attachments.map((a) => a.url),
  );
  const full = await Issue.findOne({ organizationId, displayId });
  if (!full) throw new HttpError(404, "Issue not found");
  const storedContent =
    content || (attachments.length > 0 ? "Attached files." : "");
  await Comment.create({
    organizationId,
    issueId: full._id,
    userId: new mongoose.Types.ObjectId(userId),
    content: storedContent,
    attachments,
  });
  full.updatedAt = new Date();
  await full.save();
  return getIssueDetail(organizationId, userId, displayId);
}

export async function updateComment(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  displayId: string,
  commentId: string,
  text: string,
): Promise<IssueDetailDto> {
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    throw new HttpError(400, "Invalid input");
  }
  const { issue } = await loadIssueForUser(organizationId, userId, displayId);
  const issueOid = (issue as unknown as { _id: mongoose.Types.ObjectId })._id;
  const comment = await Comment.findOne({
    _id: new mongoose.Types.ObjectId(commentId),
    organizationId,
    issueId: issueOid,
  });
  if (!comment) throw new HttpError(404, "Comment not found");
  if (comment.userId.toString() !== userId) {
    throw new HttpError(403, "You can only edit your own comments");
  }
  const content = text.trim();
  const attCount = (comment.attachments ?? []).length;
  if (!content && attCount === 0) {
    throw new HttpError(400, "Invalid input");
  }
  const storedContent = content || (attCount > 0 ? "Attached files." : "");
  comment.content = storedContent;
  await comment.save();
  const full = await Issue.findOne({ organizationId, displayId });
  if (!full) throw new HttpError(404, "Issue not found");
  full.updatedAt = new Date();
  await full.save();
  return getIssueDetail(organizationId, userId, displayId);
}

export async function addAttachment(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  displayId: string,
  meta: { filename: string; size: number; mimeType: string; url?: string },
): Promise<IssueAttachmentDto> {
  await loadIssueForUser(organizationId, userId, displayId);
  const full = await Issue.findOne({ organizationId, displayId });
  if (!full) throw new HttpError(404, "Issue not found");
  if ((full.attachments?.length ?? 0) >= MAX_ISSUE_ATTACHMENTS) {
    throw new HttpError(400, "Too many attachments on this issue");
  }
  const filename = meta.filename || "upload.bin";
  const trimmedUrl = meta.url?.trim();
  if (!trimmedUrl || !isTrustedUploadUrl(trimmedUrl)) {
    throw new HttpError(400, "Invalid attachment URL");
  }
  await assertAttachmentUrlsOwnedByOrganization(organizationId, [trimmedUrl]);
  const url = trimmedUrl;
  const at = {
    id: `att-${randomUUID()}`,
    filename,
    size: typeof meta.size === "number" ? meta.size : 1024,
    mimeType: meta.mimeType || "application/octet-stream",
    url,
  };
  full.attachments.push(at);
  full.updatedAt = new Date();
  await full.save();
  return at;
}

export async function removeAttachment(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  displayId: string,
  attachmentId: string,
): Promise<void> {
  await loadIssueForUser(organizationId, userId, displayId);
  const full = await Issue.findOne({ organizationId, displayId });
  if (!full) throw new HttpError(404, "Issue not found");
  const idx = full.attachments.findIndex((a) => a.id === attachmentId);
  if (idx < 0) throw new HttpError(404, "Attachment not found");
  const removed = full.attachments[idx];
  const gridId = attachmentGridFsIdFromTrustedUrl(removed.url);
  full.attachments.splice(idx, 1);
  full.updatedAt = new Date();
  await full.save();
  if (gridId) {
    try {
      // Only delete the stored file when it belongs to this organization and nothing else uses it.
      const meta = await getAttachmentFileMeta(gridId);
      const ownedByOrg = Boolean(meta?.organizationId.equals(organizationId));
      if (!ownedByOrg || (await isAttachmentUrlStillReferenced(organizationId, removed.url))) {
        return;
      }
      await deleteAttachmentFromGridFs(gridId);
    } catch (e) {
      console.error("Attachment GridFS delete failed", e);
    }
  }
}
