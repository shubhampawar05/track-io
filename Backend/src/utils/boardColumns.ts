import { HttpError } from "../middleware/errorHandler";

export const MAX_BOARD_COLUMNS = 20;

export type BoardColumnDto = { id: string; title: string; status: string };

/** Canonical defaults; matches frontend board defaults. */
export const DEFAULT_BOARD_COLUMNS: BoardColumnDto[] = [
  { id: "col-backlog", title: "Backlog", status: "backlog" },
  { id: "col-todo", title: "Todo", status: "todo" },
  { id: "col-in-progress", title: "In Progress", status: "in-progress" },
  { id: "col-done", title: "Done", status: "done" },
];

/** Statuses that must remain on the board (cannot be removed from validated payloads). */
export const PROTECTED_BOARD_STATUSES = new Set([
  "backlog",
  "todo",
  "in-progress",
  "done",
]);

const BOARD_STATUS_RANK_ORDER = ["backlog", "todo", "in-progress", "done", "canceled"];

export function boardColumnStatusRank(status: string): number {
  const i = BOARD_STATUS_RANK_ORDER.indexOf(status);
  return i === -1 ? 1000 : i;
}

function sortColumnsByStatusRank(cols: BoardColumnDto[]): BoardColumnDto[] {
  return [...cols].sort((a, b) => {
    const dr = boardColumnStatusRank(a.status) - boardColumnStatusRank(b.status);
    if (dr !== 0) return dr;
    return a.status.localeCompare(b.status);
  });
}

const STATUS_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Same rule as board column `status` values (lowercase kebab-case). */
export function isValidStatusSlug(s: string): boolean {
  return s.length > 0 && s.length <= 64 && STATUS_SLUG_REGEX.test(s);
}

/** Normalize DB subdocs into DTOs; returns null if missing or invalid (caller uses defaults). */
export function normalizeBoardColumnsFromDoc(
  raw: unknown,
): BoardColumnDto[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: BoardColumnDto[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const status = typeof o.status === "string" ? o.status.trim().toLowerCase() : "";
    if (!id || !title || !isValidStatusSlug(status)) return null;
    if (seen.has(status)) return null;
    seen.add(status);
    out.push({ id, title, status });
  }
  if (out.length > MAX_BOARD_COLUMNS) return null;
  for (const s of PROTECTED_BOARD_STATUSES) {
    if (!out.some((c) => c.status === s)) return null;
  }
  return out;
}

/**
 * Validates client PATCH payloads: non-empty array, unique statuses, slug rules,
 * and all protected core statuses must be present.
 */
export function parseAndValidateBoardColumns(body: unknown): BoardColumnDto[] {
  if (!Array.isArray(body)) throw new HttpError(400, "Invalid board columns");
  if (body.length === 0) throw new HttpError(400, "Invalid board columns");
  if (body.length > MAX_BOARD_COLUMNS) throw new HttpError(400, "Too many board columns");
  const statuses = new Set<string>();
  const out: BoardColumnDto[] = [];
  for (const item of body) {
    if (!item || typeof item !== "object") throw new HttpError(400, "Invalid board column");
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const status = typeof o.status === "string" ? o.status.trim().toLowerCase() : "";
    if (!id || id.length > 128) throw new HttpError(400, "Invalid board column");
    if (!title || title.length > 120) throw new HttpError(400, "Invalid board column title");
    if (!isValidStatusSlug(status)) throw new HttpError(400, "Invalid board column status");
    if (statuses.has(status)) throw new HttpError(400, "Duplicate board column status");
    statuses.add(status);
    out.push({ id, title, status });
  }
  for (const s of PROTECTED_BOARD_STATUSES) {
    if (!statuses.has(s)) throw new HttpError(400, "Missing required board column");
  }
  return out;
}

export function effectiveProjectBoardColumns(project: {
  boardColumns?: unknown;
}): BoardColumnDto[] {
  const normalized = normalizeBoardColumnsFromDoc(project.boardColumns);
  return normalized ?? DEFAULT_BOARD_COLUMNS;
}

type ProjectLike = { boardColumns?: unknown };

/** Dedupe by status; order by BOARD_STATUS_RANK_ORDER then alphabetically by status. */
export function unionColumnsFromProjects(projects: ProjectLike[]): BoardColumnDto[] {
  const byStatus = new Map<string, BoardColumnDto>();
  for (const p of projects) {
    const cols = effectiveProjectBoardColumns(p);
    for (const c of cols) {
      if (!byStatus.has(c.status)) byStatus.set(c.status, { ...c });
    }
  }
  if (byStatus.size === 0) return [...DEFAULT_BOARD_COLUMNS];
  return sortColumnsByStatusRank([...byStatus.values()]);
}
