import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { boardColumnsArrayPath } from "./boardColumnSchema";

const projectSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    slug: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    keyPrefix: { type: String, required: true, trim: true },
    color: { type: String, required: true },
    status: { type: String, default: "Active" },
    progress: { type: Number, default: 0 },
    memberIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    boardColumns: boardColumnsArrayPath,
    /** When set, `owner/repo` — PR webhooks from this repo auto-link to issues in this org. */
    githubRepoFullName: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

projectSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
projectSchema.index({ organizationId: 1 });

export type ProjectDoc = InferSchemaType<typeof projectSchema> & { _id: mongoose.Types.ObjectId };
export const Project = mongoose.model("Project", projectSchema);
