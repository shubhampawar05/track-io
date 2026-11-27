import type { Request, Response } from "express";
import { env } from "../config/env";
import { HttpError } from "../middleware/errorHandler";
import * as githubIntegrationService from "../services/githubIntegration.service";
import { fail, ok } from "../types/api";

function redirectToIntegrations(res: Response, query: Record<string, string>) {
  const u = new URL("/integrations", env.FRONTEND_ORIGIN);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
  res.redirect(302, u.toString());
}

export async function githubStatus(req: Request, res: Response) {
  try {
    const data = await githubIntegrationService.getGithubStatus(req.organizationId!);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function githubOauthUrl(req: Request, res: Response) {
  try {
    const data = await githubIntegrationService.getGithubOauthUrl(req.organizationId!, req.userId!);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function githubDisconnect(req: Request, res: Response) {
  try {
    await githubIntegrationService.disconnectGithub(req.organizationId!, req.userId!);
    res.json(ok(true));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function githubOAuthCallback(req: Request, res: Response) {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  try {
    await githubIntegrationService.completeGithubOAuth(code, state, req.userId!);
    redirectToIntegrations(res, { github: "connected" });
  } catch {
    redirectToIntegrations(res, { github: "error" });
  }
}
