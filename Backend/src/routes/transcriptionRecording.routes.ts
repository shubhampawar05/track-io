import { Router } from "express";
import multer from "multer";
import * as recordingController from "../controllers/transcriptionRecording.controller";
import { requireAuth } from "../middleware/auth";
import { requireOrganization } from "../middleware/organization";
import { byUser, rateLimit } from "../middleware/rateLimit";

const HOUR = 60 * 60_000;
import { fail } from "../types/api";

const recordingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || "").toLowerCase().split(";")[0] ?? "";
    const allowed = new Set([
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
    ]);
    if (!allowed.has(mime)) {
      cb(new Error("Unsupported audio format"));
      return;
    }
    cb(null, true);
  },
});

export const transcriptionRecordingRoutes = Router();

transcriptionRecordingRoutes.use(requireAuth, requireOrganization);

transcriptionRecordingRoutes.post("/", (req, res, next) => {
  recordingUpload.single("file")(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json(fail(String((err as Error).message || "Invalid upload")));
      return;
    }
    next();
  });
}, (req, res) => void recordingController.postRecording(req, res));

transcriptionRecordingRoutes.get("/:recordingId", (req, res) => void recordingController.getOne(req, res));
/** Each call spends OpenAI credits: cap per user. */
transcriptionRecordingRoutes.post(
  "/:recordingId/transcribe",
  rateLimit("ai-transcribe", 30, { windowMs: HOUR, keyBy: byUser }),
  (req, res) => void recordingController.postTranscribe(req, res),
);
transcriptionRecordingRoutes.post(
  "/:recordingId/candidates",
  rateLimit("ai-candidates", 30, { windowMs: HOUR, keyBy: byUser }),
  (req, res) => void recordingController.postCandidates(req, res),
);
