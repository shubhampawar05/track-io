/**
 * Demo seed: workspace, members, projects, board columns, sprints, issues (all statuses/priorities),
 * subtasks (including linked issues), attachments, GitHub links, comments, invites, transcriptions,
 * and GitHub integration + webhook fields (placeholder token — not a real GitHub session).
 *
 * Requires MONGODB_URI in Backend/.env
 *
 * Fresh load:
 *   npm run db:reset && npm run seed
 *
 * Idempotent: if demo@track.io already exists, exits without changes (run db:reset first to re-seed).
 */
import "dotenv/config";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { assertSafeDatabaseTarget } from "./dbGuard";
import { env } from "../config/env";
import { Comment } from "../models/Comment";
import { GithubIntegration } from "../models/GithubIntegration";
import { Issue } from "../models/Issue";
import { Membership } from "../models/Membership";
import { Organization } from "../models/Organization";
import { OrganizationInvite } from "../models/OrganizationInvite";
import { Project } from "../models/Project";
import { Sprint } from "../models/Sprint";
import { TranscriptionRecording } from "../models/TranscriptionRecording";
import { User } from "../models/User";
import { encryptGithubAccessToken } from "../utils/githubTokenCrypto";
import { sealSecret } from "../utils/secretBox";
import { initialsFromName } from "../utils/initials";
import { hashToken } from "../utils/tokenCrypto";

const DEMO_EMAIL = "demo@track.io";
const DEMO_PASSWORD = "password123";

/** Use this token with GET /api/auth/invite-preview and POST /api/auth/accept-invite (as pending@track.io). */
const SEED_PENDING_INVITE_RAW = "trackio-seed-invite-pending-user";

const rawUri = process.env.MONGODB_URI?.trim();
if (!rawUri) {
  console.error(
    "Missing MONGODB_URI. Copy Backend/.env.example to Backend/.env and set your Atlas connection string.",
  );
  process.exit(1);
}
const uri = rawUri;
assertSafeDatabaseTarget(uri, "seed");

type SeedUser = { email: string; name: string };

const EXTRA_USERS: SeedUser[] = [
  { email: "john@track.io", name: "John Doe" },
  { email: "alice@track.io", name: "Alice Smith" },
  { email: "mark@track.io", name: "Mark King" },
  { email: "ryan@track.io", name: "Ryan Lee" },
];

/** Org-level board: defaults plus a Canceled column for triage demos. */
const ORG_ISSUES_BOARD_COLUMNS = [
  { id: "col-backlog", title: "Backlog", status: "backlog" },
  { id: "col-todo", title: "Todo", status: "todo" },
  { id: "col-in-progress", title: "In progress", status: "in-progress" },
  { id: "col-done", title: "Done", status: "done" },
  { id: "col-canceled", title: "Canceled", status: "canceled" },
] as const;

/** Custom column titles on one project (status slugs unchanged). */
const QUANTUM_PROJECT_BOARD_COLUMNS = [
  { id: "col-backlog", title: "Ideas", status: "backlog" },
  { id: "col-todo", title: "Ready", status: "todo" },
  { id: "col-in-progress", title: "Building", status: "in-progress" },
  { id: "col-done", title: "Shipped", status: "done" },
  { id: "col-canceled", title: "Dropped", status: "canceled" },
] as const;

type ProjectSeedDef = {
  slug: string;
  name: string;
  keyPrefix: string;
  color: string;
  status: string;
  progress: number;
  githubRepoFullName: string;
  boardColumns?: { id: string; title: string; status: string }[];
};

const PROJECTS: ProjectSeedDef[] = [
  {
    slug: "linear-architect",
    name: "Linear Architect",
    keyPrefix: "LA",
    color: "bg-indigo-500",
    status: "Active",
    progress: 65,
    githubRepoFullName: "",
  },
  {
    slug: "quantum-core",
    name: "Quantum Core",
    keyPrefix: "QC",
    color: "bg-purple-500",
    status: "On Hold",
    progress: 32,
    githubRepoFullName: "",
    boardColumns: [...QUANTUM_PROJECT_BOARD_COLUMNS],
  },
  {
    slug: "nebula-ui",
    name: "Nebula UI",
    keyPrefix: "NEB",
    color: "bg-blue-500",
    status: "Planning",
    progress: 10,
    githubRepoFullName: "",
  },
  {
    slug: "vector-engine",
    name: "Vector Engine",
    keyPrefix: "VE",
    color: "bg-emerald-500",
    status: "Active",
    progress: 88,
    githubRepoFullName: "trackio-demo/vector-engine",
  },
];

type SubtaskSeed = {
  id: string;
  title: string;
  done: boolean;
  /** Set after all issues exist — display id e.g. VE-401 */
  linkToDisplayId?: string;
};

type IssueSeed = {
  keyPrefix: string;
  number: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  /** Omit or null for unassigned */
  assigneeEmail?: string | null;
  label: string;
  unread: boolean;
  sortOrder: number;
  dueDate?: Date | null;
  comments?: {
    authorEmail: string;
    body: string;
    attachments?: { filename: string; size: number; mimeType: string; url: string }[];
  }[];
  attachments?: { filename: string; size: number; mimeType: string; url: string }[];
  subtasks?: SubtaskSeed[];
  githubLinks?: {
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
  }[];
};

const ISSUES: IssueSeed[] = [
  {
    keyPrefix: "LA",
    number: 101,
    title: "Implement dynamic bento grid layout for user dashboards",
    description:
      "Build a responsive bento grid for dashboards. Review Figma specs, implement with accessible markup, and cover mobile breakpoints.",
    status: "todo",
    priority: "high",
    assigneeEmail: "john@track.io",
    label: "Feature",
    unread: true,
    sortOrder: 0,
    dueDate: new Date(Date.now() + 5 * 864e5),
    comments: [
      { authorEmail: "john@track.io", body: "Started layout scaffolding; grid approach looks right for v1." },
      {
        authorEmail: "alice@track.io",
        body: "Attached the latest contrast audit for the tile chrome.",
        attachments: [
          {
            filename: "contrast-notes.png",
            size: 88_432,
            mimeType: "image/png",
            url: "https://example.com/mock/contrast-notes.png",
          },
        ],
      },
    ],
    attachments: [
      {
        filename: "specifications.pdf",
        size: 2_516_582,
        mimeType: "application/pdf",
        url: "https://example.com/mock/specifications.pdf",
      },
    ],
    subtasks: [
      { id: "la-101-st1", title: "Responsive breakpoints for 3 breakpoints", done: true },
      { id: "la-101-st2", title: "Keyboard focus order for tiles", done: false },
    ],
    githubLinks: [
      {
        id: "seed-gh-la-101",
        kind: "pull_request",
        owner: "trackio-demo",
        repo: "linear-architect",
        pullNumber: 128,
        headRef: "feature/LA-101-bento-grid",
        htmlUrl: "https://github.com/trackio-demo/linear-architect/pull/128",
        title: "feat(dashboard): bento grid layout",
        state: "open",
        merged: false,
        source: "manual",
      },
    ],
  },
  {
    keyPrefix: "LA",
    number: 102,
    title: "Audit typography contrast ratios for accessibility compliance",
    description: "Run contrast checks on primary text and fix failing pairs.",
    status: "todo",
    priority: "medium",
    assigneeEmail: "alice@track.io",
    label: "Improvement",
    unread: false,
    sortOrder: 1,
  },
  {
    keyPrefix: "LA",
    number: 103,
    title: "Refactor glassmorphism utility classes for performance",
    description: "Reduce blur cost on low-end devices.",
    status: "in-progress",
    priority: "medium",
    assigneeEmail: "john@track.io",
    label: "Chore",
    unread: false,
    sortOrder: 2,
  },
  {
    keyPrefix: "LA",
    number: 104,
    title: "Backlog: explore command palette plugins API",
    description: "Spike only — no ship commitment this sprint.",
    status: "backlog",
    priority: "low",
    assigneeEmail: null,
    label: "General",
    unread: false,
    sortOrder: 3,
  },
  {
    keyPrefix: "LA",
    number: 105,
    title: "Canceled: legacy Flash export path",
    description: "Product dropped support; closing out the ticket.",
    status: "canceled",
    priority: "low",
    assigneeEmail: "ryan@track.io",
    label: "Chore",
    unread: false,
    sortOrder: 4,
  },
  {
    keyPrefix: "LA",
    number: 106,
    title: "Release checklist for LA-101",
    description: "Verify dependent engine work before we call the dashboard done.",
    status: "todo",
    priority: "urgent",
    assigneeEmail: "alice@track.io",
    label: "Docs",
    unread: true,
    sortOrder: 5,
    subtasks: [
      {
        id: "la-106-st1",
        title: "Confirm engine rate limits (see VE-401)",
        done: false,
        linkToDisplayId: "VE-401",
      },
      { id: "la-106-st2", title: "Update changelog", done: false },
    ],
  },
  {
    keyPrefix: "QC",
    number: 201,
    title: "Global state migration to signal-based architecture",
    description: "Incremental migration plan for core stores.",
    status: "in-progress",
    priority: "high",
    assigneeEmail: "mark@track.io",
    label: "Feature",
    unread: true,
    sortOrder: 0,
    attachments: [
      {
        filename: "requirements.txt",
        size: 12_288,
        mimeType: "text/plain",
        url: "https://example.com/mock/requirements.txt",
      },
    ],
    githubLinks: [
      {
        id: "seed-gh-qc-branch",
        kind: "branch",
        owner: "trackio-demo",
        repo: "quantum-core",
        pullNumber: null,
        headRef: "spike/signals-migration",
        htmlUrl: "https://github.com/trackio-demo/quantum-core/tree/spike/signals-migration",
        title: "",
        state: "open",
        merged: false,
        source: "manual",
      },
    ],
  },
  {
    keyPrefix: "QC",
    number: 202,
    title: "Automated PR review workflows for CI/CD pipeline",
    description: "Wire GitHub checks into the pipeline.",
    status: "in-progress",
    priority: "medium",
    assigneeEmail: "ryan@track.io",
    label: "Improvement",
    unread: false,
    sortOrder: 1,
  },
  {
    keyPrefix: "QC",
    number: 203,
    title: "Urgent: patch dependency with security advisory",
    description: "CVE triage — bump lockfile and verify tests.",
    status: "todo",
    priority: "urgent",
    assigneeEmail: "mark@track.io",
    label: "Bug",
    unread: true,
    sortOrder: 2,
    dueDate: new Date(Date.now() + 1 * 864e5),
  },
  {
    keyPrefix: "NEB",
    number: 301,
    title: "Redesign command palette for keyboard-first navigation",
    description: "Improve discoverability and latency.",
    status: "done",
    priority: "low",
    assigneeEmail: "ryan@track.io",
    label: "Feature",
    unread: false,
    sortOrder: 0,
  },
  {
    keyPrefix: "NEB",
    number: 302,
    title: "Backlog: motion presets for dialog transitions",
    description: "Collect references; implement later.",
    status: "backlog",
    priority: "medium",
    assigneeEmail: null,
    label: "Improvement",
    unread: false,
    sortOrder: 1,
  },
  {
    keyPrefix: "NEB",
    number: 303,
    title: "Fix focus trap when nested modals close",
    description: "Regression from v2 shell; add regression test.",
    status: "in-progress",
    priority: "high",
    assigneeEmail: "alice@track.io",
    label: "Bug",
    unread: false,
    sortOrder: 2,
  },
  {
    keyPrefix: "VE",
    number: 401,
    title: "Rate limit backoff strategy for ingestion API",
    description: "Design exponential backoff and idempotency keys for bulk ingest.",
    status: "in-progress",
    priority: "high",
    assigneeEmail: "mark@track.io",
    label: "Feature",
    unread: false,
    sortOrder: 0,
    comments: [
      {
        authorEmail: "demo@track.io",
        body: "Treat this as the parent dependency for LA-106 checklist items.",
      },
    ],
  },
  {
    keyPrefix: "VE",
    number: 402,
    title: "Shard metrics by tenant for hot-path isolation",
    description: "Operational hardening before scale test.",
    status: "todo",
    priority: "medium",
    assigneeEmail: "john@track.io",
    label: "Improvement",
    unread: true,
    sortOrder: 1,
  },
  {
    keyPrefix: "VE",
    number: 403,
    title: "Done: baseline load generator harness",
    description: "Checked in under tools/loadgen.",
    status: "done",
    priority: "low",
    assigneeEmail: "ryan@track.io",
    label: "Chore",
    unread: false,
    sortOrder: 2,
  },
];

function projectSlugForKeyPrefix(prefix: string): string {
  const p = PROJECTS.find((x) => x.keyPrefix === prefix);
  if (!p) throw new Error(`Unknown keyPrefix ${prefix}`);
  return p.slug;
}

function publicApiOrigin(): string {
  const base = env.API_PUBLIC_URL?.replace(/\/$/, "");
  if (base) return base;
  return `http://localhost:${env.PORT}`;
}

async function main() {
  await mongoose.connect(uri);

  const existing = await User.findOne({ email: DEMO_EMAIL.toLowerCase() }).lean();
  if (existing) {
    console.log(`Seed skipped: user ${DEMO_EMAIL} already exists.`);
    console.log("  To wipe and re-seed: npm run db:reset && npm run seed");
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const demo = await User.create({
    email: DEMO_EMAIL.toLowerCase(),
    passwordHash,
    name: "Demo User",
    initials: initialsFromName("Demo User"),
  });

  const others: mongoose.Document[] = [];
  for (const u of EXTRA_USERS) {
    others.push(
      await User.create({
        email: u.email.toLowerCase(),
        passwordHash,
        name: u.name,
        initials: initialsFromName(u.name),
      }),
    );
  }

  const allUsers = [demo, ...others];
  const byEmail = new Map(allUsers.map((u) => [(u as { email: string }).email.toLowerCase(), u]));

  const webhookPathToken = randomBytes(24).toString("hex");
  const webhookSecret = randomBytes(32).toString("hex");

  const org = await Organization.create({
    name: "Demo Workspace",
    ownerId: demo._id,
    issuesBoardColumns: [...ORG_ISSUES_BOARD_COLUMNS],
    githubWebhookPathToken: webhookPathToken,
    githubWebhookSecret: sealSecret(webhookSecret),
  });

  await Membership.create({ userId: demo._id, organizationId: org._id, role: "owner" });
  for (const u of others) {
    const uid = (u as { _id: mongoose.Types.ObjectId })._id;
    const email = (u as unknown as { email: string }).email.toLowerCase();
    const role = email === "alice@track.io" ? "admin" : "member";
    await Membership.create({ userId: uid, organizationId: org._id, role });
  }

  const memberIds = allUsers.map((u) => (u as { _id: mongoose.Types.ObjectId })._id);
  const projectDocs: mongoose.Document[] = [];

  for (const def of PROJECTS) {
    const p = await Project.create({
      organizationId: org._id,
      slug: def.slug,
      name: def.name,
      keyPrefix: def.keyPrefix,
      color: def.color,
      status: def.status,
      progress: def.progress,
      memberIds,
      boardColumns: def.boardColumns ? [...def.boardColumns] : undefined,
      githubRepoFullName: def.githubRepoFullName,
    });
    projectDocs.push(p);
  }

  const projectBySlug = new Map<string, { _id: mongoose.Types.ObjectId }>(
    projectDocs.map((p) => {
      const doc = p as unknown as { slug: string; _id: mongoose.Types.ObjectId };
      return [doc.slug, doc];
    }),
  );

  const inviteExpires = new Date(Date.now() + 7 * 864e5);
  await OrganizationInvite.create({
    organizationId: org._id,
    email: "pending@track.io",
    tokenHash: hashToken(SEED_PENDING_INVITE_RAW),
    expiresAt: inviteExpires,
    role: "member",
    invitedByUserId: demo._id,
    status: "pending",
  });
  await OrganizationInvite.create({
    organizationId: org._id,
    email: "old-invite@track.io",
    tokenHash: hashToken(`cancelled-${randomBytes(8).toString("hex")}`),
    expiresAt: new Date(Date.now() + 864e5),
    role: "member",
    invitedByUserId: demo._id,
    status: "cancelled",
  });

  const ghEnc = encryptGithubAccessToken("ghp_SEED_PLACEHOLDER_NOT_A_REAL_GITHUB_TOKEN");
  await GithubIntegration.create({
    organizationId: org._id,
    ...ghEnc,
    githubUserId: "900001",
    githubLogin: "trackio-seed-bot",
    scope: "repo read:org",
  });

  await Sprint.create({
    organizationId: org._id,
    name: "Sprint 24 — Launch readiness",
    startAt: new Date(Date.now() - 7 * 864e5),
    endAt: new Date(Date.now() + 7 * 864e5),
    isActive: true,
  });
  await Sprint.create({
    organizationId: org._id,
    name: "Sprint 23 — Foundations",
    startAt: new Date(Date.now() - 28 * 864e5),
    endAt: new Date(Date.now() - 15 * 864e5),
    isActive: false,
  });

  await TranscriptionRecording.create({
    organizationId: org._id,
    userId: demo._id,
    filename: "standup-2026-04-14.m4a",
    mimeType: "audio/mp4",
    size: 482_000,
    durationMs: 186_000,
    transcriptText:
      "[Demo transcript] Reviewed sprint goals, API rate-limit spike for VE-401, and agreed on owners for LA-101 polish.",
    status: "ready",
  });
  await TranscriptionRecording.create({
    organizationId: org._id,
    userId: demo._id,
    filename: "brainstorm-nebula-ui.wav",
    mimeType: "audio/wav",
    size: 1_024_000,
    durationMs: null,
    transcriptText: "",
    status: "failed",
    errorMessage: "Seed demo: simulated transcription failure.",
  });
  const aliceUser = byEmail.get("alice@track.io") as unknown as { _id: mongoose.Types.ObjectId };
  await TranscriptionRecording.create({
    organizationId: org._id,
    userId: aliceUser._id,
    filename: "1-1-marketing-sync.mp3",
    mimeType: "audio/mpeg",
    size: 320_000,
    durationMs: 95_000,
    transcriptText: "[Demo] Alice: campaign timeline; Mark: dependency on NEB-301 shipping first.",
    status: "ready",
  });

  const displayIdToExists = new Set<string>();

  for (const row of ISSUES) {
    const slug = projectSlugForKeyPrefix(row.keyPrefix);
    const proj = projectBySlug.get(slug) as { _id: mongoose.Types.ObjectId } | undefined;
    if (!proj) throw new Error(`Project not found for ${slug}`);
    const assigneeEmail = row.assigneeEmail;
    const assignee =
      assigneeEmail == null || assigneeEmail === ""
        ? null
        : byEmail.get(String(assigneeEmail).toLowerCase());
    if (assigneeEmail && !assignee) throw new Error(`User not found ${assigneeEmail}`);
    const displayId = `${row.keyPrefix}-${row.number}`;
    const attachments = (row.attachments ?? []).map((a, i) => ({
      id: `seed-att-${displayId}-${i}`,
      filename: a.filename,
      size: a.size,
      mimeType: a.mimeType,
      url: a.url,
    }));

    const subtasksForCreate = (row.subtasks ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      done: s.done,
      linkedIssueId: null as string | null,
    }));

    const githubLinks = (row.githubLinks ?? []).map((g) => ({
      ...g,
      updatedAt: new Date(),
    }));

    const issue = await Issue.create({
      organizationId: org._id,
      projectId: proj._id,
      displayId,
      number: row.number,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      assigneeId: assignee ? (assignee as { _id: mongoose.Types.ObjectId })._id : null,
      dueDate: row.dueDate ?? null,
      label: row.label,
      unread: row.unread,
      sortOrder: row.sortOrder,
      attachments,
      subtasks: subtasksForCreate,
      githubLinks,
    });

    displayIdToExists.add(displayId);

    for (const c of row.comments ?? []) {
      const author = byEmail.get(c.authorEmail.toLowerCase());
      if (!author) continue;
      const cAtt = (c.attachments ?? []).map((a, i) => ({
        id: `seed-catt-${displayId}-${i}`,
        filename: a.filename,
        size: a.size,
        mimeType: a.mimeType,
        url: a.url,
      }));
      await Comment.create({
        organizationId: org._id,
        issueId: issue._id,
        userId: (author as { _id: mongoose.Types.ObjectId })._id,
        content: c.body,
        attachments: cAtt,
      });
    }
  }

  for (const row of ISSUES) {
    const hasLink = row.subtasks?.some((s) => s.linkToDisplayId);
    if (!hasLink) continue;
    const displayId = `${row.keyPrefix}-${row.number}`;
    const issue = await Issue.findOne({ organizationId: org._id, displayId }).exec();
    if (!issue) throw new Error(`Issue ${displayId} missing for subtask link pass`);
    const subtasks = (row.subtasks ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      done: s.done,
      linkedIssueId:
        s.linkToDisplayId && displayIdToExists.has(s.linkToDisplayId) ? s.linkToDisplayId : null,
    }));
    issue.set("subtasks", subtasks);
    await issue.save();
  }

  const webhookUrl = `${publicApiOrigin()}/api/integrations/github/webhook/${webhookPathToken}`;

  console.log("Seed complete.");
  console.log(`  Primary login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Extra users (same password): ${EXTRA_USERS.map((u) => u.email).join(", ")}`);
  console.log(`  Organization: ${org.name} (${org._id.toString()})`);
  console.log(`  Pending invite: pending@track.io — raw token: ${SEED_PENDING_INVITE_RAW}`);
  console.log(`  GitHub (demo): connected as trackio-seed-bot (placeholder token — reconnect for real API).`);
  console.log(`  Webhook URL (demo credentials): ${webhookUrl}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
