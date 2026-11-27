import mongoose, { Schema, type InferSchemaType } from "mongoose";

const membershipSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    role: {
      type: String,
      enum: ["owner", "admin", "member"],
      required: true,
    },
  },
  { timestamps: true },
);

membershipSchema.index({ userId: 1, organizationId: 1 }, { unique: true });
membershipSchema.index({ organizationId: 1 });

export type MembershipDoc = InferSchemaType<typeof membershipSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Membership = mongoose.model("Membership", membershipSchema);
