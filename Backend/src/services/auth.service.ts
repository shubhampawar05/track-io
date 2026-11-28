import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { HttpError } from "../middleware/errorHandler";
import { Membership } from "../models/Membership";
import { Organization } from "../models/Organization";
import { User } from "../models/User";
import { LIMITS, assertMaxLength, isValidEmail } from "../utils/inputLimits";
import { isDuplicateKeyError } from "../utils/mongoErrors";
import { initialsFromName } from "../utils/initials";

export type OrganizationSummary = { id: string; name: string; role: string };

function roleRank(role: string): number {
  if (role === "owner") return 0;
  if (role === "admin") return 1;
  return 2;
}

/** Deterministic order: owner workspaces first, then admin, then member; tie-break by name and id. */
function sortOrganizationsForDisplay(orgs: OrganizationSummary[]): OrganizationSummary[] {
  return [...orgs].sort((a, b) => {
    const dr = roleRank(a.role) - roleRank(b.role);
    if (dr !== 0) return dr;
    const dn = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    if (dn !== 0) return dn;
    return a.id.localeCompare(b.id);
  });
}

export type AuthMePayload = {
  id: string;
  email: string;
  name: string;
  initials: string;
  organizations: OrganizationSummary[];
  currentOrganizationId: string | null;
};

async function buildMePayload(
  userId: mongoose.Types.ObjectId,
  preferredOrgId?: string | null,
): Promise<AuthMePayload> {
  const user = await User.findById(userId).lean();
  if (!user) throw new HttpError(401, "Unauthorized");
  const memberships = await Membership.find({ userId }).lean();
  const orgIds = memberships.map((m) => m.organizationId);
  const orgs = await Organization.find({ _id: { $in: orgIds } })
    .select("name")
    .lean();
  const nameById = new Map(orgs.map((o) => [o._id.toString(), o.name]));
  const organizations: OrganizationSummary[] = memberships.map((m) => ({
    id: m.organizationId.toString(),
    name: nameById.get(m.organizationId.toString()) ?? "Organization",
    role: m.role,
  }));
  const sorted = sortOrganizationsForDisplay(organizations);
  let currentOrganizationId = sorted[0]?.id ?? null;
  if (
    preferredOrgId &&
    mongoose.Types.ObjectId.isValid(preferredOrgId) &&
    sorted.some((o) => o.id === preferredOrgId)
  ) {
    currentOrganizationId = preferredOrgId;
  }
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    initials: user.initials,
    organizations: sorted,
    currentOrganizationId,
  };
}

export async function registerService(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthMePayload> {
  const email = input.email.toLowerCase().trim();
  const name = input.name.trim();
  const password = input.password;
  if (!email || !password || !name) throw new HttpError(400, "Invalid input");
  if (!isValidEmail(email)) throw new HttpError(400, "Invalid email address");
  assertMaxLength(name, LIMITS.name, "Name");
  if (password.length > 200) throw new HttpError(400, "Password is too long");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  const exists = await User.findOne({ email }).lean();
  if (exists) throw new HttpError(409, "Email already registered");
  const passwordHash = await bcrypt.hash(password, 10);
  const initials = initialsFromName(name);
  let user;
  try {
    user = await User.create({ email, passwordHash, name, initials });
  } catch (err) {
    // A concurrent registration with the same email won the unique index race.
    if (isDuplicateKeyError(err)) throw new HttpError(409, "Email already registered");
    throw err;
  }
  const org = await Organization.create({
    name: `${name}'s Workspace`,
    ownerId: user._id,
  });
  await Membership.create({
    userId: user._id,
    organizationId: org._id,
    role: "owner",
  });
  return buildMePayload(user._id);
}

export async function patchProfileService(
  userId: string,
  input: { name?: string },
  preferredOrgId?: string | null,
): Promise<AuthMePayload> {
  if (!mongoose.Types.ObjectId.isValid(userId)) throw new HttpError(401, "Unauthorized");
  const uid = new mongoose.Types.ObjectId(userId);
  const user = await User.findById(uid);
  if (!user) throw new HttpError(401, "Unauthorized");
  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (!name) throw new HttpError(400, "Invalid input");
    assertMaxLength(name, LIMITS.name, "Name");
    user.name = name;
    user.initials = initialsFromName(name);
    await user.save();
  }
  return buildMePayload(uid, preferredOrgId);
}

/** bcrypt hash of a random string (cost 10, same as real hashes); compared when no user matches. */
const DUMMY_PASSWORD_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.3e5M5o8Zw0k7X0bZb4pVRtE3m0kS";

export async function loginService(input: { email: string; password: string }): Promise<AuthMePayload> {
  const email = input.email.toLowerCase().trim();
  const password = input.password;
  const user = await User.findOne({ email }).lean();
  // Always run one bcrypt comparison so response time does not reveal whether the email exists.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !ok) throw new HttpError(401, "Invalid email or password");
  return buildMePayload(user._id);
}

export async function meService(userId: string, preferredOrgId?: string | null): Promise<AuthMePayload> {
  if (!mongoose.Types.ObjectId.isValid(userId)) throw new HttpError(401, "Unauthorized");
  return buildMePayload(new mongoose.Types.ObjectId(userId), preferredOrgId);
}
