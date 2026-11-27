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

export type OrganizationInviteDoc = InferSchemaType<typeof organizationInviteSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const OrganizationInvite = mongoose.model("OrganizationInvite", organizationInviteSchema);
