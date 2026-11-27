import type { Request, Response } from "express";
import * as githubWebhookService from "../services/githubWebhook.service";

export async function postGithubWebhook(req: Request, res: Response) {
  const token = decodeURIComponent(String(req.params.webhookPathToken ?? ""));
  const raw = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  const sig = typeof req.headers["x-hub-signature-256"] === "string" ? req.headers["x-hub-signature-256"] : undefined;
  const event = typeof req.headers["x-github-event"] === "string" ? req.headers["x-github-event"] : undefined;
  const result = await githubWebhookService.handleGithubWebhook(token, raw, sig, event);
  if (!result.ok) {
    res.status(result.status).json({ ok: false, error: result.message ?? "Error" });
    return;
  }
  res.status(200).json({ ok: true });
}
