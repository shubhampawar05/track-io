import type { Request, Response } from "express";
import { env } from "../config/env";
import { HttpError } from "../middleware/errorHandler";
import * as authService from "../services/auth.service";
import * as inviteService from "../services/invite.service";
import * as passwordResetService from "../services/passwordReset.service";
import { fail, ok } from "../types/api";
import { COOKIE_NAME, signToken } from "../utils/jwt";
import { User } from "../models/User";

async function sessionTokenFor(userId: string): Promise<string> {
  const user = await User.findById(userId).select("tokenVersion").lean();
  return signToken(userId, user?.tokenVersion ?? 0);
}

/** Shared shape for set + clear so browsers drop the cookie reliably. */
function authCookieBase() {
  const production = env.NODE_ENV === "production";
  return {
    httpOnly: true as const,
    secure: production,
    // Lax is not sent on cross-site fetch(). Localhost + different ports is treated as same-site in
    // major browsers, so Lax still works in dev. Hosted SPA (origin A) → API (origin B) needs None.
    sameSite: production ? ("none" as const) : ("lax" as const),
    path: "/" as const,
  };
}

function authCookieOptions() {
  return { ...authCookieBase(), maxAge: 7 * 24 * 3600 * 1000 };
}

function readPreferredOrgHeader(req: Request): string | null {
  const raw = req.headers["x-organization-id"];
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  return typeof idStr === "string" && idStr.length > 0 ? idStr : null;
}

export async function me(req: Request, res: Response) {
  try {
    const data = await authService.meService(req.userId!, readPreferredOrgHeader(req));
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function login(req: Request, res: Response) {
  try {
    const body = req.body as { email?: string; password?: string };
    const data = await authService.loginService({
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
    });
    res.cookie(COOKIE_NAME, await sessionTokenFor(data.id), authCookieOptions());
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function register(req: Request, res: Response) {
  try {
    const body = req.body as { email?: string; password?: string; name?: string };
    const data = await authService.registerService({
      name: String(body.name ?? ""),
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
    });
    res.cookie(COOKIE_NAME, await sessionTokenFor(data.id), authCookieOptions());
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function patchMe(req: Request, res: Response) {
  try {
    const body = req.body as { name?: string };
    const data = await authService.patchProfileService(req.userId!, body, readPreferredOrgHeader(req));
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

/** Clears the cookie and revokes every session of the user (works with an expired/invalid cookie too). */
export async function logout(req: Request, res: Response) {
  try {
    if (req.userId) await User.updateOne({ _id: req.userId }, { $inc: { tokenVersion: 1 } });
  } catch (err) {
    console.error("Failed to revoke sessions on logout", err);
  }
  res.clearCookie(COOKIE_NAME, authCookieBase());
  res.json(ok(true));
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const body = req.body as { email?: string };
    const data = await passwordResetService.requestPasswordReset(String(body.email ?? ""));
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const body = req.body as { token?: string; password?: string };
    await passwordResetService.resetPasswordWithToken(
      String(body.token ?? ""),
      String(body.password ?? ""),
    );
    res.json(ok(true));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function acceptInvite(req: Request, res: Response) {
  try {
    const body = req.body as { token?: string };
    const data = await inviteService.acceptInviteForUser(req.userId!, String(body.token ?? ""));
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function declineInvite(req: Request, res: Response) {
  try {
    const body = req.body as { token?: string };
    await inviteService.declineInviteForUser(req.userId!, String(body.token ?? ""));
    res.json(ok(true));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function invitePreview(req: Request, res: Response) {
  try {
    const raw = req.query.token;
    const token = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
    const data = await inviteService.getInvitePreviewByToken(String(token ?? ""));
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}
