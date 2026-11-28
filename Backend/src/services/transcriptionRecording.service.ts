import mongoose from "mongoose";
import { HttpError } from "../middleware/errorHandler";
import { TranscriptionRecording } from "../models/TranscriptionRecording";
import {
  deleteAudioFromGridFs,
  readAudioBufferFromGridFs,
  saveAudioBufferToGridFs,
} from "./recordingStorage.service";
import { transcribeAudioBuffer } from "./audioTranscription.service";
import { extractCandidatesFromTranscript } from "./transcription.service";

export async function createRecording(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  file: Express.Multer.File,
  durationMs?: number,
) {
  // Normalise metadata to the schema limits *before* storing audio, so a long client filename
  // cannot fail validation after the GridFS write and orphan the file.
  const filename = (file.originalname || "recording.webm").trim().slice(0, 256) || "recording.webm";
  const mimeType = String(file.mimetype || "application/octet-stream").trim().slice(0, 128);
  const gridFsFileId = await saveAudioBufferToGridFs({
    file,
    organizationId: organizationId.toString(),
    userId,
  });
  let created;
  try {
    created = await TranscriptionRecording.create({
      organizationId,
      userId: new mongoose.Types.ObjectId(userId),
      gridFsFileId,
      filename,
      mimeType,
      size: file.size,
      durationMs: typeof durationMs === "number" && durationMs > 0 ? durationMs : null,
      status: "uploaded",
      transcriptText: "",
      errorMessage: "",
    });
  } catch (err) {
    await deleteAudioFromGridFs(gridFsFileId).catch(() => undefined);
    throw err;
  }
  return {
    id: created._id.toString(),
    status: created.status,
    filename: created.filename,
    size: created.size,
    mimeType: created.mimeType,
  };
}

async function loadOwnedRecording(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  recordingId: string,
) {
  if (!mongoose.Types.ObjectId.isValid(recordingId)) throw new HttpError(400, "Invalid recording id");
  const row = await TranscriptionRecording.findOne({
    _id: new mongoose.Types.ObjectId(recordingId),
    organizationId,
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (!row) throw new HttpError(404, "Recording not found");
  return row;
}

export async function getRecording(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  recordingId: string,
) {
  const row = await loadOwnedRecording(organizationId, userId, recordingId);
  return {
    id: row._id.toString(),
    status: row.status,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    durationMs: row.durationMs ?? null,
    transcriptText: row.transcriptText || "",
    errorMessage: row.errorMessage || "",
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

/** A transcription still "transcribing" after this long is treated as abandoned (e.g. crash). */
const STALE_TRANSCRIBING_MS = 10 * 60_000;

export async function transcribeRecording(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  recordingId: string,
) {
  const row = await loadOwnedRecording(organizationId, userId, recordingId);
  if (row.status === "ready" && String(row.transcriptText ?? "").trim()) {
    return {
      id: row._id.toString(),
      status: row.status,
      transcriptText: row.transcriptText || "",
    };
  }
  if (!row.gridFsFileId) {
    throw new HttpError(400, "No audio file to transcribe");
  }

  // Claim the job atomically so two concurrent requests cannot both pay for transcription
  // (a "transcribing" row older than the stale window is assumed abandoned and may be retried).
  const claimed = await TranscriptionRecording.findOneAndUpdate(
    {
      _id: row._id,
      $or: [
        { status: { $in: ["uploaded", "failed"] } },
        { status: "transcribing", updatedAt: { $lt: new Date(Date.now() - STALE_TRANSCRIBING_MS) } },
      ],
    },
    { $set: { status: "transcribing", errorMessage: "" } },
    { new: true },
  );
  if (!claimed) throw new HttpError(409, "Transcription is already in progress");
  row.status = claimed.status;
  row.errorMessage = "";
  try {
    const fileId = row.gridFsFileId as mongoose.Types.ObjectId;
    const audioBuffer = await readAudioBufferFromGridFs(fileId);
    const transcriptText = await transcribeAudioBuffer({
      buffer: audioBuffer,
      filename: row.filename,
      mimeType: row.mimeType,
    });
    row.transcriptText = transcriptText;
    row.status = "ready";
    row.errorMessage = "";
    await row.save();
    try {
      await deleteAudioFromGridFs(fileId);
      await TranscriptionRecording.updateOne({ _id: row._id }, { $unset: { gridFsFileId: 1 } });
    } catch (cleanupError) {
      console.error("TranscriptionRecording GridFS cleanup failed", cleanupError);
    }
    return {
      id: row._id.toString(),
      status: row.status,
      transcriptText,
    };
  } catch (error) {
    row.status = "failed";
    row.errorMessage = error instanceof HttpError ? error.message : "Transcription failed";
    await row.save();
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, "Transcription failed");
  }
}

export async function extractRecordingCandidates(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  recordingId: string,
) {
  const row = await loadOwnedRecording(organizationId, userId, recordingId);
  const transcriptText = String(row.transcriptText ?? "").trim();
  if (!transcriptText) throw new HttpError(400, "Recording transcript not ready");
  const candidates = await extractCandidatesFromTranscript(transcriptText);
  return {
    recordingId: row._id.toString(),
    status: row.status,
    candidates,
  };
}
