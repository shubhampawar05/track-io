import mongoose, { Schema, type InferSchemaType } from "mongoose";

const sprintSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    /** At most one active sprint per org is expected; enforced in service when activating. */
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true },
);

sprintSchema.index({ organizationId: 1, isActive: 1 });

export type SprintDoc = InferSchemaType<typeof sprintSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Sprint = mongoose.model("Sprint", sprintSchema);
