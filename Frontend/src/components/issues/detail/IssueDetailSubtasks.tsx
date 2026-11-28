"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { apiJson, apiJsonWithStatus } from "@/lib/api-client";
import {
  buildIssueDetailUrl,
  type IssueNavFrom,
} from "@/lib/issue-detail-from";
import type { IssueDetail, IssueSubtask } from "@/types/issue";
import { useUIStore } from "@/stores/useUIStore";
import { issueDetailBorderedInputFocusClass } from "@/components/issues/detail/issueDetailPropertySelectStyles";
import { listRowAssigneeTooltip } from "@/utils/issuePriority";
function newSubtaskId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `st-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function serializeSubtasks(list: IssueSubtask[]) {
  return list.map((s) => ({
    id: s.id,
    title: s.title,
    done: s.done,
    linkedIssueId: s.linkedIssueId ?? null,
  }));
}

function formatLinkedDue(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dueClass(done: boolean, linked: boolean) {
  if (!linked) return "text-linear-text-muted";
  return done ? "font-medium text-emerald-400/95" : "text-[var(--text)]";
}

function normalizeIssueKey(raw: string): string {
  const t = raw.trim().replace(/\s+/g, "");
  if (!t) return "";
  const m = /^([A-Za-z]+)-(\d+)$/.exec(t);
  if (m) return `${m[1].toUpperCase()}-${m[2]}`;
  return t;
}

function useIssueNavFromParams() {
  const sp = useSearchParams();
  return useMemo(() => {
    const fromRaw = sp.get("from");
    const from: IssueNavFrom =
      fromRaw === "list" ? "list" : fromRaw === "project" ? "project" : "board";
    return {
      from,
      projectSlug: sp.get("projectSlug"),
      projectView:
        sp.get("view") === "board" ? ("board" as const) : ("list" as const),
    };
  }, [sp]);
}

export function IssueDetailSubtasks({
  issue,
  onRefresh,
}: {
  issue: IssueDetail;
  onRefresh: () => Promise<void>;
}) {
  const showToast = useUIStore((s) => s.showToast);
  const navOpts = useIssueNavFromParams();
  const [issueKeyInput, setIssueKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  /** Covers the key lookup + save; the ref blocks a second submit before re-render. */
  const [linking, setLinking] = useState(false);
  const linkingRef = useRef(false);

  const list = useMemo(() => issue.subtasks ?? [], [issue.subtasks]);
  const doneCount = list.filter((s) => s.done).length;
  const total = list.length;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const persist = useCallback(
    async (next: IssueSubtask[]) => {
      setSaving(true);
      try {
        const r = await apiJson(`/api/issues/${encodeURIComponent(issue.id)}`, {
          method: "PATCH",
          body: { subtasks: serializeSubtasks(next) },
        });
        if (!r.success) {
          showToast(r.error, "error");
          return;
        }
        await onRefresh();
      } finally {
        setSaving(false);
      }
    },
    [issue.id, onRefresh, showToast],
  );

  const toggle = (id: string) => {
    const next = list.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
    void persist(next);
  };

  const addLinkedSubtask = useCallback(async () => {
    const key = normalizeIssueKey(issueKeyInput);
    if (!key || linkingRef.current) return;
    linkingRef.current = true;
    setLinking(true);
    try {
      const { status, payload } = await apiJsonWithStatus<IssueDetail>(
        `/api/issues/${encodeURIComponent(key)}`,
      );
      if (!payload.success || status === 404) {
        showToast(payload.error ?? "Issue not found", "error");
        return;
      }
      const linkedId = payload.data.id.trim();
      if (linkedId === issue.id) {
        showToast("Cannot link an issue to itself", "error");
        return;
      }
      if (
        list.some(
          (s) => (s.linkedIssueId ?? "").toLowerCase() === linkedId.toLowerCase(),
        )
      ) {
        showToast("That issue is already linked as a subtask", "error");
        return;
      }
      const title = payload.data.title.trim() || linkedId;
      await persist([
        ...list,
        {
          id: newSubtaskId(),
          title,
          done: false,
          linkedIssueId: linkedId,
        },
      ]);
      setIssueKeyInput("");
    } catch {
      showToast("Could not link that issue. Check your connection and try again.", "error");
    } finally {
      linkingRef.current = false;
      setLinking(false);
    }
  }, [issue.id, issueKeyInput, list, persist, showToast]);

  return (
    <section
      id="issue-section-subtasks"
      className="scroll-mt-28 space-y-4"
      aria-labelledby="subtasks-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            id="subtasks-heading"
            className="text-base font-semibold tracking-tight text-[var(--text)]"
          >
            Subtasks
          </h2>
          {total > 0 ? (
            <p className="mt-1.5 text-xs text-linear-text-muted">
              {doneCount}/{total} completed
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-linear-text-muted">
              Link existing issues by their key (e.g. LA-12).
            </p>
          )}
        </div>
      </div>

      {total > 0 ? (
        <div className="space-y-3">
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="min-w-0 max-w-full overflow-visible rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        {list.length === 0 ? (
          <p className="px-5 py-10 text-center text-xs text-linear-text-muted">
            No subtasks yet. Add an existing issue key below (e.g. LA-12).
          </p>
        ) : (
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[10px] font-bold uppercase tracking-[0.18em] text-linear-text-muted">
                <th className="w-11 px-4 py-3" aria-label="Done" />
                <th className="px-5 py-3">Task</th>
                <th className="hidden w-20 px-3 py-3 sm:table-cell">
                  Assignee
                </th>
                <th className="hidden w-28 px-4 py-3 md:table-cell">Due</th>
                <th className="w-14 px-4 py-3 text-right" aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const linked = Boolean(s.linkedIssueId);
                const href =
                  linked && s.linkedIssueId
                    ? buildIssueDetailUrl(s.linkedIssueId, {
                        from: navOpts.from,
                        projectSlug: navOpts.projectSlug,
                        projectView: navOpts.projectView,
                      })
                    : null;

                return (
                  <tr
                    key={s.id}
                    className="group border-t border-[var(--border)] first:border-t-0 transition-colors hover:bg-white/[0.025]"
                  >
                    <td className="w-11 cursor-pointer px-4 py-3 align-middle">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => toggle(s.id)}
                        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md p-0 text-linear-text-muted hover:text-[var(--text)] disabled:opacity-50"
                        aria-pressed={s.done}
                        aria-label={
                          s.done ? "Mark incomplete" : "Mark complete"
                        }
                      >
                        <Check
                          className={`h-4 w-4 ${s.done ? "text-emerald-400" : "opacity-35"}`}
                          strokeWidth={2.5}
                        />
                      </button>
                    </td>
                    <td className="max-w-0 min-w-0 px-4 py-3 align-middle">
                      {linked && href ? (
                        <Link
                          href={href}
                          className={`block min-w-0 truncate rounded-lg px-1.5 py-0.5 text-left font-medium leading-5 hover:bg-white/[0.07] focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50 ${
                            s.done
                              ? "text-linear-text-muted line-through transition-colors"
                              : "text-(--text) no-underline decoration-2 underline-offset-2 decoration-[color-mix(in_srgb,var(--text)_30%,transparent)] transition-[color,text-decoration-color,opacity] duration-150 ease-out opacity-90 group-hover:opacity-100 group-hover:underline dark:opacity-80 dark:decoration-white/30 dark:group-hover:opacity-100"
                          }`}
                          title={s.title}
                        >
                          {s.title}
                        </Link>
                      ) : (
                        <span
                          className={`block min-w-0 truncate px-1.5 py-0.5 text-left leading-5 ${
                            s.done
                              ? "text-linear-text-muted line-through"
                              : "text-[var(--text)]"
                          }`}
                          title={s.title}
                        >
                          {s.title}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-3 py-3 align-middle sm:table-cell">
                      <div className="group/assignee relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-linear-text-muted dark:bg-transparent cursor-pointer">
                        <span
                          className={`transition-transform duration-150 ease-out group-hover/assignee:scale-[1.25] border border-(--border) rounded-full p-1 ${listRowAssigneeTooltip(issue) === "Unassigned" ? "size-6 flex items-center justify-center" : ""}`}
                        >
                          {issue.assignee}
                        </span>
                        <span
                          className="pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-[#111118] px-2 py-1 text-[10px] font-medium text-white/90 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 ease-out group-hover/assignee:opacity-100"
                          role="tooltip"
                        >
                          {listRowAssigneeTooltip(issue)}
                        </span>
                      </div>
                    </td>
                    <td
                      className={`hidden px-4 py-3 align-middle text-xs md:table-cell ${dueClass(s.done, linked)}`}
                    >
                      {linked ? formatLinkedDue(s.linkedDueDate) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-sm">
        <p className="mb-2 text-[11px] font-medium text-linear-text-muted">
          Add Issue Key
        </p>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={issueKeyInput}
            onChange={(e) => setIssueKeyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addLinkedSubtask();
              }
            }}
            placeholder="e.g. LA-12"
            disabled={saving}
            className={`min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-white/[0.03] px-3 py-2 font-mono text-sm text-[var(--text)] placeholder:text-linear-text-muted/50 ${issueDetailBorderedInputFocusClass}`}
          />
          <button
            type="button"
            disabled={saving || linking || !normalizeIssueKey(issueKeyInput)}
            onClick={() => void addLinkedSubtask()}
            className="linear-accent-fill flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-md transition-[opacity,filter] hover:brightness-110 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            aria-label="Link issue as subtask"
          >
            <Plus className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </section>
  );
}
