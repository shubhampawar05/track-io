import OpenAI from "openai";
import { env } from "../config/env";
import { HttpError } from "../middleware/errorHandler";
import { LIMITS } from "../utils/inputLimits";
import type { ExtractCandidate } from "./transcription.service";

type RawCandidate = {
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  confidence?: unknown;
};

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

export function __setOpenAiClientForTests(mockClient: OpenAI | null) {
  client = mockClient;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function normalizePriority(raw: unknown): ExtractCandidate["priority"] {
  const v = String(raw ?? "medium").toLowerCase();
  if (v === "low" || v === "medium" || v === "high" || v === "urgent") return v;
  return "medium";
}

function normalizeDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeText(raw: unknown, maxLen: number): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export function normalizeLlmCandidates(input: unknown): ExtractCandidate[] {
  if (!Array.isArray(input)) return [];
  const out: ExtractCandidate[] = [];
  for (let i = 0; i < input.length && out.length < 100; i += 1) {
    const item = input[i] as RawCandidate;
    if (!item || typeof item !== "object") continue;
    const title = normalizeText(item.title, 140);
    if (!title) continue;
    const description = normalizeText(item.description, 2000);
    const confidenceRaw =
      typeof item.confidence === "number"
        ? item.confidence
        : Number(String(item.confidence ?? ""));
    out.push({
      clientId: `cand-${out.length + 1}`,
      title,
      description,
      priority: normalizePriority(item.priority),
      dueDate: normalizeDate(item.dueDate),
      confidence: clamp01(confidenceRaw),
    });
  }
  return out;
}

function extractJsonArray(text: string): unknown[] {
  const raw = text.trim();
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      const parsed = JSON.parse(match[0]) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export async function extractCandidatesWithLlm(transcriptText: string): Promise<ExtractCandidate[]> {
  const text = transcriptText.trim();
  if (!text) return [];
  if (!env.OPENAI_API_KEY) {
    throw new HttpError(
      503,
      "Transcription AI is not configured. Set OPENAI_API_KEY in Backend/.env and restart the API.",
    );
  }
  const prompt = [
    "You extract actionable software work items from meeting transcripts.",
    "Return ONLY a JSON array. No markdown, no prose.",
    "Each item must have:",
    "- title: short actionable task",
    "- description: concise detail",
    "- priority: one of low|medium|high|urgent",
    "- dueDate: ISO date string or null",
    "- confidence: number 0..1",
  ].join("\n");
  try {
    const res = await openAiClient().responses.create({
      model: env.OPENAI_MODEL,
      temperature: 0.1,
      max_output_tokens: 1400,
      input: [
        { role: "system", content: prompt },
        {
          role: "user",
          // Text uploads are rejected above this limit; long audio transcripts are cut here.
          content: `Transcript:\n${text.slice(0, LIMITS.transcript)}`,
        },
      ],
    });
    const responseText = res.output_text ?? "[]";
    return normalizeLlmCandidates(extractJsonArray(responseText));
  } catch (error: unknown) {
    if (error instanceof HttpError) throw error;
    const e = error as { status?: number; code?: string; message?: string };
    if (e?.status === 401) {
      throw new HttpError(502, "OpenAI authentication failed. Check OPENAI_API_KEY.");
    }
    if (e?.status === 403) {
      throw new HttpError(502, "OpenAI access denied for configured project/model.");
    }
    if (e?.status === 404) {
      throw new HttpError(502, "OpenAI model not found. Check OPENAI_MODEL.");
    }
    if (e?.status === 429) {
      throw new HttpError(502, "OpenAI rate limit or quota exceeded.");
    }
    // Keep upstream details in server logs only; clients get a generic message.
    console.error("OpenAI extraction failed", e?.status, e?.message);
    throw new HttpError(502, "Failed to extract tasks from transcription");
  }
}
