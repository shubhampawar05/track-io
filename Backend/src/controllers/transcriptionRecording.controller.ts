import type { Request, Response } from "express";
import { HttpError } from "../middleware/errorHandler";
import * as recordingService from "../services/transcriptionRecording.service";
import { fail, ok } from "../types/api";

export async function postRecording(req: Request, res: Response) {
  try {
    const body = req.body as { durationMs?: unknown };
    const durationMs =
      typeof body.durationMs === "number"
        ? body.durationMs
        : typeof body.durationMs === "string"
          ? Number(body.durationMs)
          : undefined;
    if (!req.file) throw new HttpError(400, "Audio file is required");
    const data = await recordingService.createRecording(req.organizationId!, req.userId!, req.file, durationMs);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function getOne(req: Request, res: Response) {
  try {
    const recordingId = decodeURIComponent(String(req.params.recordingId));
    const data = await recordingService.getRecording(req.organizationId!, req.userId!, recordingId);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function postTranscribe(req: Request, res: Response) {
  try {
    const recordingId = decodeURIComponent(String(req.params.recordingId));
    const data = await recordingService.transcribeRecording(req.organizationId!, req.userId!, recordingId);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function postCandidates(req: Request, res: Response) {
  try {
    const recordingId = decodeURIComponent(String(req.params.recordingId));
    const data = await recordingService.extractRecordingCandidates(req.organizationId!, req.userId!, recordingId);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}
