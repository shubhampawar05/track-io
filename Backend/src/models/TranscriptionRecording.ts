import mongoose, { Schema, type InferSchemaType } from "mongoose";

const transcriptionRecordingSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    gridFsFileId: { type: Schema.Types.ObjectId, required: false },
    filename: { type: String, required: true, trim: true, maxlength: 256 },
    mimeType: { type: String, required: true, trim: true, maxlength: 128 },
    size: { type: Number, required: true, min: 0 },
    durationMs: { type: Number, default: null },
    transcriptText: { type: String, default: "" },
    status: {
      type: String,
      enum: ["uploaded", "transcribing", "ready", "failed"],
      default: "uploaded",
      index: true,
    },
    errorMessage: { type: String, default: "" },
  },
  { timestamps: true },
);

transcriptionRecordingSchema.index({ organizationId: 1, userId: 1, createdAt: -1 });

export type TranscriptionRecordingDoc =
  InferSchemaType<typeof transcriptionRecordingSchema> & { _id: mongoose.Types.ObjectId };
export const TranscriptionRecording = mongoose.model("TranscriptionRecording", transcriptionRecordingSchema);
