import { Router } from "express";
import multer from "multer";
import * as transcriptionController from "../controllers/transcription.controller";
import { requireAuth } from "../middleware/auth";
import { requireOrganization } from "../middleware/organization";
import { transcriptionRecordingRoutes } from "./transcriptionRecording.routes";
import { fail } from "../types/api";

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

transcriptionRoutes.post("/extract", (req, res, next) => {
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
