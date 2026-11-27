import type { Request, Response } from "express";
import mongoose from "mongoose";
import { HttpError } from "../middleware/errorHandler";
import { Membership } from "../models/Membership";
import {
  getAttachmentFileMeta,
  openAttachmentDownloadStream,
  saveAttachmentBufferToGridFs,
} from "../services/attachmentStorage.service";
import { fail, ok } from "../types/api";

export async function postUpload(req: Request, res: Response) {
  try {
    const f = req.file;
    if (!f) {
      res.status(400).json(fail("No file"));
      return;
    }
    if (!req.organizationId || !req.userId) {
      res.status(401).json(fail("Unauthorized"));
      return;
    }
    const gridId = await saveAttachmentBufferToGridFs({
      file: f,
      organizationId: req.organizationId.toString(),
      userId: req.userId,
    });
    const url = `/api/uploads/files/${gridId.toString()}`;
    res.json(
      ok({
        url,
        filename: f.originalname || f.filename,
        size: f.size,
        mimeType: f.mimetype,
      }),
    );
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Upload failed"));
  }
}

export async function getUploadFile(req: Request, res: Response) {
  const rawId = typeof req.params.fileId === "string" ? req.params.fileId : req.params.fileId?.[0];
  if (!rawId || !mongoose.Types.ObjectId.isValid(rawId)) {
    res.status(400).json(fail("Invalid file id"));
    return;
  }
  if (!req.userId) {
    res.status(401).json(fail("Unauthorized"));
    return;
  }
  const fileId = new mongoose.Types.ObjectId(rawId);
  try {
    const fileMeta = await getAttachmentFileMeta(fileId);
    if (!fileMeta) {
      res.status(404).json(fail("File not found"));
      return;
    }
    const member = await Membership.findOne({
      userId: new mongoose.Types.ObjectId(req.userId),
      organizationId: fileMeta.organizationId,
    }).lean();
    if (!member) {
      res.status(404).json(fail("File not found"));
      return;
    }
    const { filename, contentType } = fileMeta;
    const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(filename)}; filename="${asciiFallback}"`,
    );
    const stream = openAttachmentDownloadStream(fileId);
    stream.on("error", () => {
      if (!res.headersSent) res.status(404).end();
      else res.destroy();
    });
    stream.pipe(res);
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Download failed"));
  }
}
