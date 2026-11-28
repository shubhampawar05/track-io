import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { boardColumnsArrayPath } from "./boardColumnSchema";

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** When unset, GET /issues-board-columns uses union of all project boards. */
    issuesBoardColumns: boardColumnsArrayPath,
    /** Opaque segment in webhook URL; unguessable. Set only when webhook is configured. */
    githubWebhookPathToken: { type: String, trim: true },
    /**
     * Shared secret for GitHub webhook HMAC (X-Hub-Signature-256), stored sealed (utils/secretBox).
     * Legacy plaintext values are still accepted until `npm run migrate:secrets` seals them.
     */
    githubWebhookSecret: { type: String, trim: true },
  },
  { timestamps: true },
);

organizationSchema.index({ ownerId: 1 });
organizationSchema.index({ githubWebhookPathToken: 1 }, { unique: true, sparse: true });

export type OrganizationDoc = InferSchemaType<typeof organizationSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Organization = mongoose.model("Organization", organizationSchema);
