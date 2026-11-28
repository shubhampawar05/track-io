export type Status =
  | "todo"
  | "in-progress"
  | "done"
  | "backlog"
  | "canceled"
  | string;

export type Priority = "low" | "medium" | "high" | "urgent" | "none";

export interface GithubLink {
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
}

export interface Issue {
  /** Stable id for URLs / API */
  id: string;
  /** Human-readable key, e.g. LA-12 */
  key?: string;
  title: string;
  status: Status;
  priority: Priority;
  label: string;
  assignee: string;
  /** Full name from API for tooltips; optional for mock / legacy payloads */
  assigneeName?: string | null;
  date: string;
  /** Order within the same `status` (0-based), from API / board */
  sortOrder?: number;
  /** Project slug */
  projectId?: string;
  /** From API when present */
  githubLinkCount?: number;
}

export interface IssueComment {
  id: string;
  /** Matches signed-in user id when this comment is yours. */
  authorUserId: string;
  authorName: string;
  authorInitials: string;
  avatarSeed: string;
  timeLabel: string;
  body: string;
  attachments: IssueAttachment[];
}

export interface IssueAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  url: string;
}

export interface IssueSubtask {
  id: string;
  title: string;
  done: boolean;
  /** Issue key (`displayId`) to open when the row is clicked. */
  linkedIssueId?: string | null;
  linkedAssigneeInitials?: string | null;
  linkedDueDate?: string | null;
}

export interface IssueDetail extends Issue {
  description: string;
  unread: boolean;
  comments: IssueComment[];
  attachments: IssueAttachment[];
  subtasks: IssueSubtask[];
  githubLinks?: GithubLink[];
  projectSlug: string;
  projectName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeInitials: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export type IntegrationIconId = "github" | "slack" | "fireflies";

export interface IntegrationMeta {
  id: string;
  name: string;
  description: string;
  icon: IntegrationIconId;
  connected: boolean;
}

export interface ProjectCard {
  slug: string;
  name: string;
  status: string;
  members: number;
  progress: number;
  color: string;
  /** GitHub `owner/repo` for automatic PR linking via webhooks */
  githubRepoFullName?: string;
}

export interface ProjectMember {
  id: string;
  name: string;
  initials: string;
}

export interface OrganizationMember {
  userId: string;
  name: string;
  email: string;
  initials: string;
  role: string;
}

export interface OrganizationInviteRow {
  id: string;
  email: string;
  role: string;
  status: string;
  invitedByUserId: string;
  invitedByName: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export type BoardColumnDto = {
  id: string;
  title: string;
  status: string;
};

export interface ProjectDetail {
  id: string;
  slug: string;
  name: string;
  keyPrefix: string;
  githubRepoFullName: string;
  memberCount: number;
  issueCount: number;
  members: ProjectMember[];
  boardColumns: BoardColumnDto[];
}

/** Payload from NewIssueModal when creating an issue */
export interface NewIssueCreatePayload {
  title: string;
  description: string;
  status: string;
  priority: Priority;
  /** Category label; omit for server default `General` */
  label?: string;
  /** Omitted = server defaults to current user; `null` = unassigned */
  assigneeId?: string | null;
  /** Global create: explicit project when the modal has no route slug */
  projectSlug?: string | null;
  /** Optional ISO date (e.g. from `type="date"` at UTC midnight) */
  dueDate?: string | null;
}

export interface TranscriptionCandidate {
  clientId: string;
  title: string;
  description: string;
  priority: Priority;
  dueDate: string | null;
  confidence: number;
}

export interface RecordingUploadResult {
  id: string;
  status: "uploaded" | "transcribing" | "ready" | "failed";
  filename: string;
  size: number;
  mimeType: string;
}

export type ToastType = "success" | "error";

export interface ToastState {
  /** Unique per `showToast` call so a replacement toast restarts its timer. */
  id: number;
  message: string;
  type: ToastType;
}
