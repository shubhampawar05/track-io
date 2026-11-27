import type { Status } from "@/types/issue";

export type BoardColumnConfig = {
  id: string;
  title: string;
  status: Status;
};

/** Core workflow statuses that cannot be removed from the board. */
export const PROTECTED_BOARD_STATUSES = new Set([
  "backlog",
  "todo",
  "in-progress",
  "done",
]);

export function slugifyColumnTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "column";
}
