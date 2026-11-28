import mongoose from "mongoose";
import { HttpError } from "../middleware/errorHandler";
import * as issueService from "./issue.service";
import { assertProjectMember } from "./project.service";
import { extractCandidatesWithLlm } from "./transcriptionLlm.service";

type Priority = "low" | "medium" | "high" | "urgent";

export type ExtractCandidate = {
  clientId: string;
  title: string;
  description: string;
  priority: Priority;
  dueDate: string | null;
  confidence: number;
};

type CreateCandidateInput = {
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  assigneeId?: unknown;
};

export type CreateCandidatesInput = {
  projectSlug: string;
  items: CreateCandidateInput[];
};

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export async function extractCandidatesFromTranscript(text: string): Promise<ExtractCandidate[]> {
  const clean = String(text ?? "").trim();
  if (!clean) return [];
  return extractCandidatesWithLlm(clean);
}

function parseDueDate(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") throw new HttpError(400, "Invalid due date");
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, "Invalid due date");
  return d.toISOString();
}

function parsePriority(raw: unknown): Priority {
  if (raw === undefined || raw === null || raw === "") return "medium";
  if (typeof raw !== "string") throw new HttpError(400, "Invalid priority");
  const lowered = raw.toLowerCase();
  if (lowered === "low" || lowered === "medium" || lowered === "high" || lowered === "urgent") return lowered;
  throw new HttpError(400, "Invalid priority");
}

function parseAssigneeId(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string" || !mongoose.Types.ObjectId.isValid(raw)) {
    throw new HttpError(400, "Invalid assignee");
  }
  return raw;
}

function parseCreateItem(raw: CreateCandidateInput): {
  title: string;
  description: string;
  priority: Priority;
  dueDate?: string;
  assigneeId?: string | null;
} {
  const title = normalizeWhitespace(String(raw.title ?? ""));
  if (!title) throw new HttpError(400, "Invalid title");
  const description = normalizeWhitespace(String(raw.description ?? ""));
  const priority = parsePriority(raw.priority);
  const dueDate = parseDueDate(raw.dueDate);
  const assigneeId = parseAssigneeId(raw.assigneeId);
  return {
    title,
    description,
    priority,
    ...(dueDate ? { dueDate } : {}),
    ...(assigneeId === undefined ? {} : { assigneeId }),
  };
}

export async function createIssuesFromCandidates(
  organizationId: mongoose.Types.ObjectId,
  userId: string,
  input: CreateCandidatesInput,
) {
  const projectSlug = String(input.projectSlug ?? "").trim();
  if (!projectSlug) throw new HttpError(400, "Project is required");
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new HttpError(400, "At least one item is required");
  }
  if (input.items.length > 50) throw new HttpError(400, "Too many items");
  await assertProjectMember(organizationId, userId, projectSlug);
  const created: Awaited<ReturnType<typeof issueService.createIssueUnderProject>>[] = [];
  const skipped: { reason: string; item: { title: string } }[] = [];
  for (const raw of input.items as unknown[]) {
    const rawTitle =
      raw && typeof raw === "object" ? String((raw as { title?: unknown }).title ?? "").trim() : "";
    if (!raw || typeof raw !== "object") {
      skipped.push({ reason: "Invalid item", item: { title: rawTitle } });
      continue;
    }
    try {
      const parsed = parseCreateItem(raw as Parameters<typeof parseCreateItem>[0]);
      // Due date goes in with the create, so an issue is never created and then reported
      // as "skipped" because a follow-up patch failed.
      const issue = await issueService.createIssueUnderProject(organizationId, userId, projectSlug, {
        title: parsed.title,
        description: parsed.description,
        priority: parsed.priority,
        status: "todo",
        assigneeId: parsed.assigneeId,
        dueDate: parsed.dueDate ?? null,
      });
      created.push(issue);
    } catch (error) {
      if (error instanceof HttpError && error.status >= 400 && error.status < 500) {
        skipped.push({ reason: error.message, item: { title: rawTitle } });
        continue;
      }
      throw error;
    }
  }
  return { created, skipped };
}
