import { Router } from "express";
import multer from "multer";
import * as transcriptionController from "../controllers/transcription.controller";
import { requireAuth } from "../middleware/auth";
import { requireOrganization } from "../middleware/organization";
import { transcriptionRecordingRoutes } from "./transcriptionRecording.routes";
import { fail } from "../types/api";
import { byUser, rateLimit } from "../middleware/rateLimit";

const HOUR = 60 * 60_000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isTextMime = /^text\/plain(?:;|$)/i.test(file.mimetype);
    const isTxtName = /\.txt$/i.test(file.originalname || "");
    if (!isTextMime && !isTxtName) {
      cb(new Error("Only .txt transcription files are supported"));
      return;
    }
    cb(null, true);
  },
});

export const transcriptionRoutes = Router();

transcriptionRoutes.use(requireAuth, requireOrganization);

/** Each call spends OpenAI credits: cap per user. */
transcriptionRoutes.post("/extract", rateLimit("ai-extract", 30, { windowMs: HOUR, keyBy: byUser }), (req, res, next) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json(fail(String((err as Error).message || "Invalid upload")));
      return;
    }
    next();
  });
}, (req, res) => void transcriptionController.extract(req, res));

transcriptionRoutes.post("/create-issues", (req, res) => void transcriptionController.createIssues(req, res));
transcriptionRoutes.use("/recordings", transcriptionRecordingRoutes);
