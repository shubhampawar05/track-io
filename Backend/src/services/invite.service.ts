import mongoose from "mongoose";
import { env } from "../config/env";
import { HttpError } from "../middleware/errorHandler";
import { Membership } from "../models/Membership";
import { Organization } from "../models/Organization";
import { OrganizationInvite } from "../models/OrganizationInvite";
import { Project } from "../models/Project";
import { User } from "../models/User";
import { buildOrganizationInviteMail } from "./emailTemplates";
import { sendMail } from "./mail.service";
import { isValidEmail } from "../utils/inputLimits";
import { isDuplicateKeyError } from "../utils/mongoErrors";
import { hashToken, randomUrlToken } from "../utils/tokenCrypto";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Public preview for accept-invite UI; throws HttpError 404 for any invalid token (no enumeration). */
export async function getInvitePreviewByToken(tokenRaw: string): Promise<{ organizationName: string; role: string }> {
  const token = tokenRaw.trim();
  if (!token) throw new HttpError(404, "Invitation not found");
  const tokenHash = hashToken(token);
  const invite = await OrganizationInvite.findOne({
    tokenHash,
    status: "pending",
  }).lean();
  if (!invite || invite.expiresAt.getTime() < Date.now()) {
    throw new HttpError(404, "Invitation not found");
  }
  const org = await Organization.findById(invite.organizationId).select("name").lean();
  if (!org) throw new HttpError(404, "Invitation not found");
  return {
    organizationName: org.name,
    role: invite.role === "admin" ? "admin" : "member",
  };
}

export async function createAndSendInvite(input: {
  organizationId: mongoose.Types.ObjectId;
  inviterUserId: string;
  membershipRole: "owner" | "admin" | "member";
  emailRaw: string;
  role: "admin" | "member";
}): Promise<{ email: string }> {
  if (input.membershipRole !== "owner" && input.membershipRole !== "admin") {
    throw new HttpError(403, "Only owners and admins can invite members");
  }
  const email = input.emailRaw.toLowerCase().trim();
  if (!email || !isValidEmail(email)) {
    throw new HttpError(400, "Invalid email address");
  }
  const org = await Organization.findById(input.organizationId).lean();
  if (!org) throw new HttpError(404, "Organization not found");

  const existingUser = await User.findOne({ email }).lean();
  if (existingUser) {
    const already = await Membership.findOne({
      userId: existingUser._id,
      organizationId: input.organizationId,
    }).lean();
    if (already) throw new HttpError(409, "That user is already a member of this workspace");
  }

  const token = randomUrlToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const invitedByUserId = new mongoose.Types.ObjectId(input.inviterUserId);

  let inviteDoc = await OrganizationInvite.findOne({
    organizationId: input.organizationId,
    email,
    status: "pending",
  });
  if (inviteDoc) {
    inviteDoc.tokenHash = tokenHash;
    inviteDoc.expiresAt = expiresAt;
    inviteDoc.role = input.role;
    inviteDoc.invitedByUserId = invitedByUserId;
    await inviteDoc.save();
  } else {
    try {
      await OrganizationInvite.create({
        organizationId: input.organizationId,
        email,
        tokenHash,
        expiresAt,
        role: input.role,
        invitedByUserId,
        status: "pending",
      });
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? (err as { code?: number }).code : undefined;
      if (code !== 11000) throw err;
      inviteDoc = await OrganizationInvite.findOne({
        organizationId: input.organizationId,
        email,
        status: "pending",
      });
      if (!inviteDoc) throw new HttpError(409, "Could not create invitation");
      inviteDoc.tokenHash = tokenHash;
      inviteDoc.expiresAt = expiresAt;
      inviteDoc.role = input.role;
      inviteDoc.invitedByUserId = invitedByUserId;
      await inviteDoc.save();
    }
  }

  const inviter = await User.findById(input.inviterUserId).select("name").lean();
  const inviterName = inviter?.name ?? "A teammate";
  const link = `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/accept-invite?token=${encodeURIComponent(token)}`;

  const roleLabel = input.role === "admin" ? "Admin" : "Member";
  const mail = buildOrganizationInviteMail({
    inviterName,
    organizationName: org.name,
    inviteeEmail: email,
    roleLabel,
    acceptUrl: link,
  });
  try {
    await sendMail({
      to: email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[mail] invite send failed", err);
    throw new HttpError(502, "Could not send invitation email");
  }

  return { email };
}

async function addOrgMemberToAllProjects(organizationId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId) {
  await Project.updateMany({ organizationId }, { $addToSet: { memberIds: userId } });
}

export async function acceptInviteForUser(
  userId: string,
  tokenRaw: string,
): Promise<{ organizationId: string }> {
  const token = tokenRaw.trim();
  if (!token) throw new HttpError(400, "Invalid invitation");
  const tokenHash = hashToken(token);
  const invite = await OrganizationInvite.findOne({
    tokenHash,
    status: "pending",
  }).exec();
  if (!invite || invite.expiresAt.getTime() < Date.now()) {
    throw new HttpError(400, "Invalid or expired invitation");
  }
  const user = await User.findById(userId).lean();
  if (!user) throw new HttpError(401, "Unauthorized");
  if (user.email !== invite.email) {
    throw new HttpError(403, "Sign in with the invited email address to accept this invitation");
  }
  const uid = new mongoose.Types.ObjectId(userId);
  const existing = await Membership.findOne({
    userId: uid,
    organizationId: invite.organizationId,
  }).lean();
  if (existing) {
    invite.status = "accepted";
    await invite.save();
    await addOrgMemberToAllProjects(invite.organizationId, uid);
    return { organizationId: invite.organizationId.toString() };
  }
  try {
    await Membership.create({
      userId: uid,
      organizationId: invite.organizationId,
      role: invite.role === "admin" ? "admin" : "member",
    });
  } catch (err) {
    // Double-submit: a concurrent accept already created the membership — same outcome.
    if (!isDuplicateKeyError(err)) throw err;
  }
  invite.status = "accepted";
  await invite.save();
  await addOrgMemberToAllProjects(invite.organizationId, uid);
  return { organizationId: invite.organizationId.toString() };
}

export type OrganizationInviteRowDto = {
  id: string;
  email: string;
  role: string;
  status: string;
  invitedByUserId: string;
  invitedByName: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export async function listInvitesForOrganization(input: {
  organizationId: mongoose.Types.ObjectId;
  membershipRole: "owner" | "admin" | "member";
}): Promise<OrganizationInviteRowDto[]> {
  if (input.membershipRole !== "owner" && input.membershipRole !== "admin") {
    throw new HttpError(403, "Only owners and admins can view invitations");
  }
  const rows = await OrganizationInvite.find({ organizationId: input.organizationId })
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();
  const inviterIds = [
    ...new Set(rows.map((r) => r.invitedByUserId.toString())),
  ].map((id) => new mongoose.Types.ObjectId(id));
  const inviters =
    inviterIds.length > 0
      ? await User.find({ _id: { $in: inviterIds } })
          .select("name")
          .lean()
      : [];
  const nameById = new Map(inviters.map((u) => [u._id.toString(), u.name ?? ""]));
  const statusRank = (s: string) => (s === "pending" ? 0 : 1);
  const sorted = [...rows].sort((a, b) => {
    const d = statusRank(a.status) - statusRank(b.status);
    if (d !== 0) return d;
    return (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0);
  });
  return sorted.map((r) => ({
    id: r._id.toString(),
    email: r.email,
    role: r.role === "admin" ? "admin" : "member",
    status: r.status,
    invitedByUserId: r.invitedByUserId.toString(),
    invitedByName: nameById.get(r.invitedByUserId.toString()) ?? "Unknown",
    expiresAt: r.expiresAt.toISOString(),
    createdAt: (r.createdAt as Date).toISOString(),
    updatedAt: (r.updatedAt as Date).toISOString(),
  }));
}

export async function cancelInviteById(input: {
  organizationId: mongoose.Types.ObjectId;
  membershipRole: "owner" | "admin" | "member";
  inviteId: string;
}): Promise<void> {
  if (input.membershipRole !== "owner" && input.membershipRole !== "admin") {
    throw new HttpError(403, "Only owners and admins can cancel invitations");
  }
  if (!mongoose.Types.ObjectId.isValid(input.inviteId)) {
    throw new HttpError(400, "Invalid invitation id");
  }
  const invite = await OrganizationInvite.findOne({
    _id: new mongoose.Types.ObjectId(input.inviteId),
    organizationId: input.organizationId,
  }).exec();
  if (!invite) throw new HttpError(404, "Invitation not found");
  if (invite.status !== "pending") {
    throw new HttpError(400, "Only pending invitations can be cancelled");
  }
  invite.status = "cancelled";
  await invite.save();
}

export async function declineInviteForUser(userId: string, tokenRaw: string): Promise<void> {
  const token = tokenRaw.trim();
  if (!token) throw new HttpError(400, "Invalid invitation");
  const tokenHash = hashToken(token);
  const invite = await OrganizationInvite.findOne({
    tokenHash,
    status: "pending",
  }).exec();
  if (!invite || invite.expiresAt.getTime() < Date.now()) {
    throw new HttpError(400, "Invalid or expired invitation");
  }
  const user = await User.findById(userId).lean();
  if (!user) throw new HttpError(401, "Unauthorized");
  if (user.email !== invite.email) {
    throw new HttpError(403, "Sign in with the invited email address to decline this invitation");
  }
  invite.status = "declined";
  await invite.save();
}
