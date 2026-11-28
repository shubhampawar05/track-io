import mongoose, { Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    initials: { type: String, required: true },
    passwordResetTokenHash: { type: String, default: null },
    passwordResetExpiresAt: { type: Date, default: null },
    /** Embedded in session JWTs; bumping it revokes every existing session (logout, password reset). */
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

/** Password-reset lookups by token hash (most users have none: sparse). */
userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const User = mongoose.model("User", userSchema);
