import { Router } from "express";
import multer from "multer";
import * as uploadController from "../controllers/upload.controller";
import { requireAuth } from "../middleware/auth";
import { requireOrganization } from "../middleware/organization";
import { fail } from "../types/api";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okMime = /^(image\/(jpeg|png|gif|webp)|application\/pdf)$/.test(file.mimetype);
    if (!okMime) {
      cb(new Error("Unsupported file type"));
      return;
    }
    cb(null, true);
  },
});

export const uploadRoutes = Router();

uploadRoutes.get("/files/:fileId", requireAuth, (req, res) =>
  void uploadController.getUploadFile(req, res),
);

uploadRoutes.post(
  "/",
  requireAuth,
  requireOrganization,
  (req, res, next) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json(fail(String((err as Error).message || "Invalid upload")));
        return;
      }
      next();
    });
  },
  (req, res) => void uploadController.postUpload(req, res),
);
