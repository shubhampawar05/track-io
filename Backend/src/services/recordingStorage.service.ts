import { Readable } from "node:stream";
import mongoose from "mongoose";
import { HttpError } from "../middleware/errorHandler";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
]);

function bucket() {
  const db = mongoose.connection.db;
  if (!db) throw new HttpError(500, "Database not ready");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: "recordings" });
}

function normalizeMimeType(mimeType: string): string {
  const raw = String(mimeType || "").trim().toLowerCase();
  return raw.split(";")[0] ?? raw;
}

export function validateAudioUploadInput(file: Express.Multer.File) {
  if (!file) throw new HttpError(400, "Audio file is required");
  const mime = normalizeMimeType(file.mimetype);
  if (!ALLOWED_AUDIO_MIME_TYPES.has(mime)) {
    throw new HttpError(400, "Unsupported audio format");
  }
  if (!file.buffer?.length) throw new HttpError(400, "Audio file is empty");
  if (file.size > MAX_AUDIO_BYTES) throw new HttpError(400, "Audio file too large");
}

export async function saveAudioBufferToGridFs(input: {
  file: Express.Multer.File;
  organizationId: string;
  userId: string;
}): Promise<mongoose.Types.ObjectId> {
  validateAudioUploadInput(input.file);
  const uploadStream = bucket().openUploadStream(input.file.originalname || "recording.webm", {
    contentType: normalizeMimeType(input.file.mimetype),
    metadata: {
      organizationId: input.organizationId,
      userId: input.userId,
      createdAt: new Date().toISOString(),
    },
  });
  const source = Readable.from(input.file.buffer);
  await new Promise<void>((resolve, reject) => {
    source
      .pipe(uploadStream)
      .on("finish", () => resolve())
      .on("error", (error) => reject(error));
  });
  return uploadStream.id as mongoose.Types.ObjectId;
}

export async function readAudioBufferFromGridFs(fileId: mongoose.Types.ObjectId): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const stream = bucket().openDownloadStream(fileId);
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve());
    stream.on("error", (error) => reject(error));
  });
  return Buffer.concat(chunks);
}

export async function deleteAudioFromGridFs(fileId: mongoose.Types.ObjectId): Promise<void> {
  await bucket().delete(fileId);
}
