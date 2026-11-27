import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "../middleware/errorHandler";
import { GithubIntegration } from "../models/GithubIntegration";
import { Membership } from "../models/Membership";
import { Organization } from "../models/Organization";
import { encryptGithubAccessToken } from "../utils/githubTokenCrypto";
import { publicApiBase } from "../utils/uploadUrl";

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const OAUTH_SCOPE = "read:user";
const STATE_PURPOSE = "github_oauth";

type StatePayload = {
  organizationId: string;
  purpose: typeof STATE_PURPOSE;
};

function assertGithubConfigured(): void {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.GITHUB_OAUTH_CALLBACK_URL) {
    throw new HttpError(503, "GitHub integration is not configured");
  }
}

async function requireOwnerOrAdmin(organizationId: mongoose.Types.ObjectId, userId: string): Promise<void> {
  const m = await Membership.findOne({
    organizationId,
    userId: new mongoose.Types.ObjectId(userId),
  }).lean();
  if (!m) throw new HttpError(403, "Forbidden");
  if (m.role !== "owner" && m.role !== "admin") {
    throw new HttpError(403, "Only owners and admins can manage GitHub");
  }
}

export async function getGithubStatus(organizationId: mongoose.Types.ObjectId): Promise<{
  connected: boolean;
  githubLogin: string | null;
  webhookConfigured: boolean;
  webhookUrl: string | null;
}> {
  const doc = await GithubIntegration.findOne({ organizationId }).lean();
  const org = await Organization.findById(organizationId).select("githubWebhookPathToken").lean();
  const pathTok = org?.githubWebhookPathToken;
  const webhookConfigured = typeof pathTok === "string" && pathTok.length > 0;
  const webhookUrl = webhookConfigured ? `${publicApiBase()}/api/integrations/github/webhook/${pathTok}` : null;
  if (!doc) return { connected: false, githubLogin: null, webhookConfigured, webhookUrl };
  return { connected: true, githubLogin: doc.githubLogin, webhookConfigured, webhookUrl };
}

function buildGithubAuthorizeUrl(organizationId: mongoose.Types.ObjectId): string {
  const orgStr = organizationId.toString();
  const state = jwt.sign(
    { organizationId: orgStr, purpose: STATE_PURPOSE } satisfies StatePayload,
    env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "10m" },
  );
  const u = new URL(GITHUB_AUTH_URL);
  u.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  u.searchParams.set("redirect_uri", env.GITHUB_OAUTH_CALLBACK_URL);
  u.searchParams.set("scope", OAUTH_SCOPE);
  u.searchParams.set("state", state);
  return u.toString();
}

export async function getGithubOauthUrl(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
): Promise<{ url: string }> {
  assertGithubConfigured();
  await requireOwnerOrAdmin(organizationId, userId);
  return { url: buildGithubAuthorizeUrl(organizationId) };
}

function parseState(state: string): mongoose.Types.ObjectId {
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(state, env.JWT_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload;
  } catch {
    throw new HttpError(400, "Invalid OAuth state");
  }
  if (decoded.purpose !== STATE_PURPOSE || typeof decoded.organizationId !== "string") {
    throw new HttpError(400, "Invalid OAuth state");
  }
  if (!mongoose.Types.ObjectId.isValid(decoded.organizationId)) {
    throw new HttpError(400, "Invalid OAuth state");
  }
  return new mongoose.Types.ObjectId(decoded.organizationId);
}

type TokenResponse = {
  access_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GithubUser = {
  id: number;
  login: string;
};

export async function completeGithubOAuth(
  code: string,
  state: string,
  userId: string,
): Promise<void> {
  assertGithubConfigured();
  if (!code || !state) throw new HttpError(400, "Invalid OAuth callback");

  const organizationId = parseState(state);
  await requireOwnerOrAdmin(organizationId, userId);

  const tokenRes = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_OAUTH_CALLBACK_URL,
    }),
  });
  const tokenJson = (await tokenRes.json()) as TokenResponse;
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new HttpError(400, "GitHub token exchange failed");
  }

  const userRes = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!userRes.ok) throw new HttpError(400, "GitHub user fetch failed");
  const ghUser = (await userRes.json()) as GithubUser;
  if (typeof ghUser.id !== "number" || typeof ghUser.login !== "string") {
    throw new HttpError(400, "GitHub user fetch failed");
  }

  const enc = encryptGithubAccessToken(tokenJson.access_token);
  await GithubIntegration.findOneAndUpdate(
    { organizationId },
    {
      organizationId,
      ...enc,
      githubUserId: String(ghUser.id),
      githubLogin: ghUser.login,
      scope: tokenJson.scope ?? OAUTH_SCOPE,
    },
    { upsert: true, new: true },
  );
}

export async function disconnectGithub(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
): Promise<void> {
  await requireOwnerOrAdmin(organizationId, userId);
  await GithubIntegration.deleteOne({ organizationId });
}
