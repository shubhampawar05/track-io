import { Readable } from "node:stream";
import mongoose from "mongoose";
import { HttpError } from "../middleware/errorHandler";

function bucket() {
  const db = mongoose.connection.db;
  if (!db) throw new HttpError(500, "Database not ready");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: "attachments" });
}

function normalizeMimeType(mimeType: string): string {
  const raw = String(mimeType || "").trim().toLowerCase();
  return raw.split(";")[0] ?? raw;
}

export async function saveAttachmentBufferToGridFs(input: {
  file: Express.Multer.File;
  organizationId: string;
  userId: string;
}): Promise<mongoose.Types.ObjectId> {
  const f = input.file;
  if (!f.buffer?.length) throw new HttpError(400, "Empty file");
  const uploadStream = bucket().openUploadStream(f.originalname || "attachment.bin", {
    contentType: normalizeMimeType(f.mimetype),
    metadata: {
      organizationId: input.organizationId,
      userId: input.userId,
      createdAt: new Date().toISOString(),
    },
  });
  const source = Readable.from(f.buffer);
  await new Promise<void>((resolve, reject) => {
    source.pipe(uploadStream).on("finish", () => resolve()).on("error", (err) => reject(err));
  });
  return uploadStream.id as mongoose.Types.ObjectId;
}

export type AttachmentFileMeta = {
  organizationId: mongoose.Types.ObjectId;
  filename: string;
  contentType: string;
};

/** GridFS file row + owning organization (from upload metadata). */
export async function getAttachmentFileMeta(
  fileId: mongoose.Types.ObjectId,
): Promise<AttachmentFileMeta | null> {
  const files = await bucket().find({ _id: fileId }).limit(1).toArray();
  const doc = files[0] as
    | {
        filename: string;
        contentType?: string;
        metadata?: { organizationId?: string };
      }
    | undefined;
  if (!doc) return null;
  const metaOrg = doc.metadata?.organizationId;
  if (!metaOrg || !mongoose.Types.ObjectId.isValid(metaOrg)) return null;
  return {
    organizationId: new mongoose.Types.ObjectId(metaOrg),
    filename: doc.filename || "attachment.bin",
    contentType: doc.contentType || "application/octet-stream",
  };
}

export function openAttachmentDownloadStream(fileId: mongoose.Types.ObjectId) {
  return bucket().openDownloadStream(fileId);
}

export async function deleteAttachmentFromGridFs(fileId: mongoose.Types.ObjectId): Promise<void> {
  try {
    await bucket().delete(fileId);
  } catch {
    // ignore missing file
  }
}
