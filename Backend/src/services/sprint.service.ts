import mongoose from "mongoose";
import { Sprint } from "../models/Sprint";

export type ActiveSprintDto = { id: string; name: string };

export async function getActiveSprint(
  organizationId: mongoose.Types.ObjectId,
): Promise<ActiveSprintDto | null> {
  const s = await Sprint.findOne({ organizationId, isActive: true })
    .select("_id name")
    .lean();
  if (!s) return null;
  return { id: s._id.toString(), name: s.name };
}
