import { randomBytes } from "crypto";
import mongoose from "mongoose";
import { HttpError } from "../middleware/errorHandler";
import { Membership } from "../models/Membership";
import { Organization } from "../models/Organization";
import { Project } from "../models/Project";
import { User } from "../models/User";
import type { BoardColumnDto } from "../utils/boardColumns";
import {
  normalizeBoardColumnsFromDoc,
  unionColumnsFromProjects,
} from "../utils/boardColumns";
import { publicApiBase } from "../utils/uploadUrl";

export type OrganizationMemberDto = {
  userId: string;
  name: string;
  email: string;
  initials: string;
  role: string;
};

export async function listMembers(
  organizationId: mongoose.Types.ObjectId,
): Promise<OrganizationMemberDto[]> {
  const rows = await Membership.find({ organizationId }).lean();
  const userIds = rows.map((r) => r.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select("name email initials")
    .lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));
  return rows.map((m) => {
    const u = userMap.get(m.userId.toString());
    return {
      userId: m.userId.toString(),
      name: u?.name ?? "Unknown",
      email: u?.email ?? "",
      initials: u?.initials ?? "?",
      role: m.role,
    };
  });
}

export async function updateOrganizationName(
  organizationId: mongoose.Types.ObjectId,
  role: "owner" | "admin" | "member",
  nameRaw: string,
): Promise<{ id: string; name: string }> {
  if (role !== "owner" && role !== "admin") {
    throw new HttpError(403, "Only owners and admins can rename the workspace");
  }
  const name = nameRaw.trim();
  if (!name) throw new HttpError(400, "Invalid input");
  const org = await Organization.findById(organizationId);
  if (!org) throw new HttpError(404, "Organization not found");
  org.name = name;
  await org.save();
  return { id: org._id.toString(), name: org.name };
}

export async function getIssuesBoardColumns(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
): Promise<{ columns: BoardColumnDto[] }> {
  const uid = new mongoose.Types.ObjectId(userId);
  const org = await Organization.findById(organizationId).select("issuesBoardColumns").lean();
  if (!org) throw new HttpError(404, "Organization not found");
  const stored = normalizeBoardColumnsFromDoc(org.issuesBoardColumns);
  if (stored) return { columns: stored };
  const projects = await Project.find({ organizationId, memberIds: uid })
    .select("boardColumns")
    .lean();
  return { columns: unionColumnsFromProjects(projects) };
}

/**
 * Persist org-wide issues board columns, or pass `null` to clear overrides so GET
 * falls back to the union of all project boards.
 */
export async function updateOrganizationIssuesBoardColumns(
  organizationId: mongoose.Types.ObjectId,
  role: "owner" | "admin" | "member",
  userId: string,
  columns: BoardColumnDto[] | null,
): Promise<{ columns: BoardColumnDto[] }> {
  if (role !== "owner" && role !== "admin") {
    throw new HttpError(403, "Only owners and admins can update the issues board");
  }
  const org = await Organization.findById(organizationId);
  if (!org) throw new HttpError(404, "Organization not found");
  if (columns === null) org.set("issuesBoardColumns", undefined);
  else org.set("issuesBoardColumns", columns);
  await org.save();
  return getIssuesBoardColumns(organizationId, userId);
}

async function requireOwnerOrAdmin(organizationId: mongoose.Types.ObjectId, userId: string): Promise<void> {
  const m = await Membership.findOne({
    organizationId,
    userId: new mongoose.Types.ObjectId(userId),
  }).lean();
  if (!m) throw new HttpError(403, "Forbidden");
  if (m.role !== "owner" && m.role !== "admin") {
    throw new HttpError(403, "Only owners and admins can manage this");
  }
}

export async function setupGithubWebhookCredentials(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
): Promise<{ webhookUrl: string; secret: string }> {
  await requireOwnerOrAdmin(organizationId, userId);
  const pathToken = randomBytes(24).toString("hex");
  const secret = randomBytes(32).toString("hex");
  const org = await Organization.findById(organizationId);
  if (!org) throw new HttpError(404, "Organization not found");
  org.githubWebhookPathToken = pathToken;
  org.githubWebhookSecret = secret;
  await org.save();
  const base = publicApiBase();
  const webhookUrl = `${base}/api/integrations/github/webhook/${pathToken}`;
  return { webhookUrl, secret };
}