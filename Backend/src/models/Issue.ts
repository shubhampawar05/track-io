import mongoose, { Schema, type InferSchemaType } from "mongoose";

const attachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    filename: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false },
);

const subtaskSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false },
    linkedIssueId: { type: String, trim: true, default: null },
  },
  { _id: false },
);


const githubLinkSchema = new Schema(
  {
    id: { type: String, required: true },
    kind: { type: String, enum: ["pull_request", "branch"], required: true },
    owner: { type: String, required: true, trim: true },
    repo: { type: String, required: true, trim: true },
    pullNumber: { type: Number, default: null },
    headRef: { type: String, default: "", trim: true },
    htmlUrl: { type: String, required: true, trim: true },
    title: { type: String, default: "", trim: true },
    state: { type: String, default: "open", trim: true },
    merged: { type: Boolean, default: false },
    source: { type: String, enum: ["webhook", "manual"], required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const issueSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    displayId: { type: String, required: true, trim: true },
    number: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, default: "todo" },
    priority: { type: String, default: "medium" },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    dueDate: { type: Date, default: null },
    label: { type: String, default: "General" },
    unread: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    attachments: { type: [attachmentSchema], default: [] },
    subtasks: { type: [subtaskSchema], default: [] },
    githubLinks: { type: [githubLinkSchema], default: [] },
  },
  { timestamps: true },
);

issueSchema.index({ organizationId: 1, displayId: 1 }, { unique: true });
issueSchema.index({ projectId: 1, number: 1 }, { unique: true });
issueSchema.index({ organizationId: 1, projectId: 1 });
issueSchema.index({ assigneeId: 1 });
issueSchema.index({ organizationId: 1, dueDate: 1 });
/** Org-wide issue list sorts by most recently updated before limiting. */
issueSchema.index({ organizationId: 1, updatedAt: -1 });

export type IssueDoc = InferSchemaType<typeof issueSchema> & { _id: mongoose.Types.ObjectId };
export const Issue = mongoose.model("Issue", issueSchema);
