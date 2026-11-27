import mongoose, { Schema, type InferSchemaType } from "mongoose";

const githubIntegrationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    encryptedAccessToken: { type: String, required: true },
    tokenIv: { type: String, required: true },
    tokenAuthTag: { type: String, required: true },
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
