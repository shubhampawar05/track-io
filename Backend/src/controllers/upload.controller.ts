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

/** File signatures for the allowed upload types; the client-declared MIME type alone is not trusted. */
function contentMatchesDeclaredType(buf: Buffer, mimeType: string): boolean {
  const starts = (...bytes: number[]) => bytes.every((b, i) => buf[i] === b);
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/gif":
      return buf.subarray(0, 4).toString("latin1") === "GIF8";
    case "image/webp":
      return buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP";
    case "application/pdf":
      return buf.subarray(0, 5).toString("latin1") === "%PDF-";
    default:
      return false;
  }
}

/** RFC 6266 quoted-string: escape backslash and double quote in the ASCII fallback name. */
function quotedAsciiFilename(filename: string): string {
  return filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
}

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
    if (!f.buffer || !contentMatchesDeclaredType(f.buffer, f.mimetype)) {
      res.status(400).json(fail("File content does not match its type"));
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
    const asciiFallback = quotedAsciiFilename(filename);
    // Images render inline (used by <img> tags); anything else (PDF) downloads, so it never
    // runs as a document on the API's origin.
    const disposition = contentType.startsWith("image/") ? "inline" : "attachment";
    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}; filename="${asciiFallback}"`,
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
