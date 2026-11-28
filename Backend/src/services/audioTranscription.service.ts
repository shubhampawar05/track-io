import { toFile } from "openai/uploads";
import { env } from "../config/env";
import { HttpError } from "../middleware/errorHandler";
import { __setOpenAiClientForTests } from "./transcriptionLlm.service";
import OpenAI from "openai";

let client: OpenAI | null = null;

function openAiClient(): OpenAI {
  if (client) return client;
  if (!env.OPENAI_API_KEY) {
    throw new HttpError(
      503,
      "Transcription AI is not configured. Set OPENAI_API_KEY in Backend/.env and restart the API.",
    );
  }
  client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return client;
}

export function __setAudioTranscriberClientForTests(mockClient: OpenAI | null) {
  client = mockClient;
  __setOpenAiClientForTests(mockClient);
}

export async function transcribeAudioBuffer(input: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<string> {
  try {
    const file = await toFile(input.buffer, input.filename || "recording.webm", {
      type: input.mimeType || "audio/webm",
    });
    const transcript = await openAiClient().audio.transcriptions.create({
      model: env.OPENAI_TRANSCRIBE_MODEL,
      file,
    });
    const text = String(transcript.text ?? "").trim();
    if (!text) throw new HttpError(502, "Transcription was empty");
    return text;
  } catch (error: unknown) {
    if (error instanceof HttpError) throw error;
    const e = error as { status?: number; message?: string };
    if (e?.status === 401) throw new HttpError(502, "OpenAI authentication failed. Check OPENAI_API_KEY.");
    if (e?.status === 429) throw new HttpError(502, "OpenAI rate limit or quota exceeded.");
    // Keep upstream details in server logs only; clients get a generic message.
    console.error("OpenAI audio transcription failed", e?.status, e?.message);
    throw new HttpError(502, "Failed to transcribe recording");
  }
}
