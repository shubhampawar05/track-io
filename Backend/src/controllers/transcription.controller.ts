import type { Request, Response } from "express";
import { HttpError } from "../middleware/errorHandler";
import * as transcriptionService from "../services/transcription.service";
import { fail, ok } from "../types/api";

function transcriptTextFromRequest(req: Request): string {
  const body = req.body as { text?: unknown };
  const fromBody = typeof body?.text === "string" ? body.text : "";
  const fileBuffer = req.file?.buffer;
  const fromFile = fileBuffer ? fileBuffer.toString("utf8") : "";
  const text = String(fromBody || fromFile || "").trim();
  if (!text) throw new HttpError(400, "Transcript text is required");
  if (text.length > 200_000) throw new HttpError(400, "Transcript is too large");
  return text;
}

export async function extract(req: Request, res: Response) {
  try {
    const text = transcriptTextFromRequest(req);
    const candidates = await transcriptionService.extractCandidatesFromTranscript(text);
    res.json(ok({ candidates }));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function createIssues(req: Request, res: Response) {
  try {
    const body = req.body as { projectSlug?: unknown; items?: unknown };
    const data = await transcriptionService.createIssuesFromCandidates(req.organizationId!, req.userId!, {
      projectSlug: String(body.projectSlug ?? ""),
      items: Array.isArray(body.items) ? (body.items as Array<Record<string, unknown>>) : [],
    });
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}
