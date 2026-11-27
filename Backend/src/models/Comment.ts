import mongoose, { Schema, type InferSchemaType } from "mongoose";

const commentAttachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    filename: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false },
);

const commentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true },
    attachments: { type: [commentAttachmentSchema], default: [] },
  },
  { timestamps: true },
);

commentSchema.index({ issueId: 1, createdAt: 1 });
commentSchema.index({ organizationId: 1 });

export type CommentDoc = InferSchemaType<typeof commentSchema> & { _id: mongoose.Types.ObjectId };
export const Comment = mongoose.model("Comment", commentSchema);
