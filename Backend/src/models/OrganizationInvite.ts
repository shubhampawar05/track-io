import mongoose, { Schema, type InferSchemaType } from "mongoose";

const organizationInviteSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
    },
    invitedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "cancelled", "declined"],
      default: "pending",
    },
  },
  { timestamps: true },
);

organizationInviteSchema.index({ tokenHash: 1 });
organizationInviteSchema.index(
  { organizationId: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
/**
 * TTL: MongoDB removes a still-pending invite 30 days after it expired (the link stopped
 * working at `expiresAt`; the grace period keeps it visible as "expired" in the members list
 * for a while). Accepted/cancelled/declined invites are kept as history.
 */
export const EXPIRED_INVITE_RETENTION_SECONDS = 30 * 24 * 60 * 60;
organizationInviteSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: EXPIRED_INVITE_RETENTION_SECONDS,
    partialFilterExpression: { status: "pending" },
  },
);

export type OrganizationInviteDoc = InferSchemaType<typeof organizationInviteSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const OrganizationInvite = mongoose.model("OrganizationInvite", organizationInviteSchema);
