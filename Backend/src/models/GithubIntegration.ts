import mongoose, { Schema, type InferSchemaType } from "mongoose";

const githubIntegrationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    /** v2 sealed token (see utils/secretBox). */
    sealedAccessToken: { type: String },
    /** Legacy (pre-v2) token fields; removed by `npm run migrate:secrets`. */
    encryptedAccessToken: { type: String },
    tokenIv: { type: String },
    tokenAuthTag: { type: String },
    githubUserId: { type: String, required: true },
    githubLogin: { type: String, required: true },
    scope: { type: String, default: "" },
  },
  { timestamps: true },
);

githubIntegrationSchema.index({ organizationId: 1 }, { unique: true });

export type GithubIntegrationDoc = InferSchemaType<typeof githubIntegrationSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const GithubIntegration = mongoose.model("GithubIntegration", githubIntegrationSchema);
