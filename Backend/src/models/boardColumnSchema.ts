import { Schema } from "mongoose";

const MAX_ENTRIES = 20;

export const boardColumnEntrySchema = new Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 128 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, required: true, trim: true, lowercase: true, maxlength: 64 },
  },
  { _id: false },
);

export const boardColumnsArrayPath = {
  type: [boardColumnEntrySchema],
  default: undefined,
  validate: {
    validator(v: unknown[] | undefined) {
      return v == null || v.length <= MAX_ENTRIES;
    },
    message: "Too many board columns",
  },
};
