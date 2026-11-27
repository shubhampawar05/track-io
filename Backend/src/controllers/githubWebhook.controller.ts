import type { Request, Response } from "express";
import * as githubWebhookService from "../services/githubWebhook.service";

export async function postGithubWebhook(req: Request, res: Response) {
  try {
    // Express already decodes route params; decoding again throws URIError on inputs like "%25".
    const token = String(req.params.webhookPathToken ?? "");
    if (!(req.body instanceof Buffer)) {
      res.status(415).json({ ok: false, error: "Webhook content type must be application/json" });
      return;
    }
    const raw = req.body;
    const sig = typeof req.headers["x-hub-signature-256"] === "string" ? req.headers["x-hub-signature-256"] : undefined;
    const event = typeof req.headers["x-github-event"] === "string" ? req.headers["x-github-event"] : undefined;
    const result = await githubWebhookService.handleGithubWebhook(token, raw, sig, event);
    if (!result.ok) {
      res.status(result.status).json({ ok: false, error: result.message ?? "Error" });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("GitHub webhook handling failed", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Something went wrong" });
  }
}
