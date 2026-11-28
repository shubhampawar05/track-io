"use client";

import type { ReactNode } from "react";
import {
  forwardRef,
  startTransition,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Copy, Link2, Paperclip } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import {
  FALLBACK_ISSUE_STATUS_OPTIONS,
  mergeIssueStatusIntoOptions,
  statusSelectOptionsFromBoardColumns,
} from "@/lib/issue-status-ui";
import { orgIssuesQueryOptions } from "@/lib/query-org-sync";
import type { BoardColumnDto, IssueDetail } from "@/types/issue";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { useUIStore } from "@/stores/useUIStore";
import {
  IssueDescriptionEditor,
  type IssueDescriptionEditorHandle,
} from "@/components/issues/detail/IssueDescriptionEditor";
import { IssueDetailNavTabs } from "@/components/issues/detail/IssueDetailNavTabs";
import { IssueDetailQuickFields } from "@/components/issues/detail/IssueDetailQuickFields";
import { IssueDetailSidePanel } from "@/components/issues/detail/IssueDetailSidePanel";

export type IssueDetailEditorHandle = {
  flushAll: () => Promise<void>;
};

function IssueHeroActions({
  onUpdateIssue,
}: {
  onUpdateIssue: () => Promise<void>;
}) {
  const showToast = useUIStore((s) => s.showToast);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const updateBusy = useRef(false);

  const copyLink = useCallback(() => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) return;
    void navigator.clipboard.writeText(url).then(
      () => showToast("Link copied"),
      () => showToast("Could not copy link", "error"),
    );
    setMenuOpen(false);
  }, [showToast]);

  const scrollToAttachments = useCallback(() => {
    document
      .getElementById("issue-section-files")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const onUpdateClick = useCallback(() => {
    if (updateBusy.current) return;
    void (async () => {
      updateBusy.current = true;
      try {
        await onUpdateIssue();
        showToast("Issue updated");
      } catch (e) {
        showToast(e instanceof Error && e.message ? e.message : "Update failed", "error");
      } finally {
        updateBusy.current = false;
      }
    })();
  }, [onUpdateIssue, showToast]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  return (
    <div className="flex items-center gap-3 shrink-0">
      <button
        type="button"
        onClick={scrollToAttachments}
        className="p-2 hover:bg-[var(--hover)] rounded-md transition-all duration-200 text-linear-text-muted"
        aria-label="Attachments"
      >
        <Paperclip className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={copyLink}
        className="p-2 hover:bg-[var(--hover)] rounded-md transition-all duration-200 text-linear-text-muted"
        aria-label="Copy link"
      >
        <Link2 className="w-4 h-4" />
      </button>
      <div className="h-4 w-px bg-[var(--border)]" />
      <button
        type="button"
        onClick={onUpdateClick}
        className="linear-button-primary"
      >
        Update Issue
      </button>
    </div>
  );
}

export const IssueDetailEditor = forwardRef<
  IssueDetailEditorHandle,
  {
    issue: IssueDetail;
    closeHref: string;
    onRefresh: () => Promise<void>;
    onUpdateIssue: () => Promise<void>;
    children?: ReactNode;
  }
>(function IssueDetailEditor(
  { issue, closeHref, onRefresh, onUpdateIssue, children },
  ref,
) {
  const [title, setTitle] = useState(issue.title);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const descRef = useRef<IssueDescriptionEditorHandle>(null);
  const showToast = useUIStore((s) => s.showToast);
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const label = issue.key ?? issue.id;

  const issuesBoardColsQuery = useQuery({
    queryKey: ["issuesBoardColumns", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async ({ queryKey }) => {
      const r = await apiJson<{ columns: BoardColumnDto[] }>(
        "/api/organizations/issues-board-columns",
        { orgId: queryKey[1] },
      );
      if (!r.success) throw new Error(r.error);
      return r.data.columns;
    },
    ...orgIssuesQueryOptions(),
  });

  const statusSelectOptions = useMemo(() => {
    const fromBoard = statusSelectOptionsFromBoardColumns(
      issuesBoardColsQuery.data,
    );
    const base = fromBoard?.length
      ? fromBoard
      : FALLBACK_ISSUE_STATUS_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
        }));
    return mergeIssueStatusIntoOptions(base, issue.status);
  }, [issuesBoardColsQuery.data, issue.status]);

  useEffect(() => {
    startTransition(() => {
      setTitle(issue.title);
    });
  }, [issue.title]);

  const copyKey = useCallback(() => {
    void navigator.clipboard.writeText(label).then(
      () => showToast("Identifier copied"),
      () => showToast("Could not copy", "error"),
    );
  }, [label, showToast]);

  const saveTitle = useCallback(async () => {
    const t = title.trim();
    if (!t) {
      setTitle(issue.title); // an issue always has a title; undo the cleared field
      return;
    }
    if (t === issue.title) return;
    const r = await apiJson(`/api/issues/${encodeURIComponent(issue.id)}`, {
      method: "PATCH",
      body: { title: t },
    });
    if (!r.success) throw new Error(r.error || "Could not save title");
    await onRefresh();
  }, [issue.id, issue.title, onRefresh, title]);

  /** Rejects on failure; IssueDescriptionEditor surfaces background save errors. */
  const saveDescription = useCallback(
    async (html: string) => {
      const r = await apiJson(`/api/issues/${encodeURIComponent(issue.id)}`, {
        method: "PATCH",
        body: { description: html },
      });
      if (!r.success) throw new Error(r.error || "Could not save description");
      await onRefresh();
    },
    [issue.id, onRefresh],
  );

  useImperativeHandle(
    ref,
    () => ({
      flushAll: async () => {
        await saveTitle();
        await descRef.current?.flush();
      },
    }),
    [saveTitle],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg)]">
      <div className="shrink-0 px-6 pt-8 sm:px-8">
        <div className="flex w-full min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Link
              href={closeHref}
              className="inline-flex shrink-0 items-center rounded-md p-1.5 text-linear-text-muted transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
              aria-label="Back to issues"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            {issue.unread ? (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-[#5e6ad2]"
                title="Unread"
              />
            ) : null}
            <span className="issue-detail-issue-key min-w-0 max-w-[min(100%,16rem)] truncate font-mono text-sm font-semibold tracking-tight">
              {label}
            </span>
            <button
              type="button"
              onClick={copyKey}
              className="shrink-0 rounded-md p-1 text-linear-text-muted transition-colors hover:bg-white/[0.06] hover:text-[var(--text)]"
              aria-label="Copy identifier"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <IssueHeroActions onUpdateIssue={onUpdateIssue} />
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-8 px-6 pb-16 pt-6 sm:px-8 lg:flex-row">
        <div
          ref={setScrollRoot}
          className="custom-scrollbar min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto lg:min-h-0"
        >
          <div className="space-y-8">
            <header className="space-y-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  saveTitle().catch((e: unknown) =>
                    showToast(
                      e instanceof Error && e.message ? e.message : "Could not save title",
                      "error",
                    ),
                  );
                }}
                className="w-full bg-transparent text-2xl font-semibold tracking-tight text-[var(--text)] placeholder:text-linear-text-muted/50 focus:outline-none sm:text-[1.65rem] sm:leading-tight"
                aria-label="Issue title"
              />
              <IssueDetailQuickFields
                issue={issue}
                onRefresh={onRefresh}
                statusSelectOptions={statusSelectOptions}
              />
            </header>
            <IssueDetailNavTabs
              scrollRoot={scrollRoot}
              commentCount={issue.comments.length}
              subtaskCount={issue.subtasks?.length ?? 0}
              filesCount={issue.attachments.length + (issue.githubLinks?.length ?? 0)}
            />
            <div className="space-y-10">
              <section
                id="issue-section-description"
                className="scroll-mt-28"
                aria-labelledby="issue-description-label"
              >
                <p
                  id="issue-description-label"
                  className="text-[10px] font-bold uppercase tracking-[0.18em] text-linear-text-muted"
                >
                  Description
                </p>
                <div className="mt-3">
                  <IssueDescriptionEditor
                    ref={descRef}
                    key={issue.id}
                    initialHtml={issue.description}
                    onSave={saveDescription}
                  />
                </div>
              </section>
              {children}
            </div>
          </div>
        </div>
        <div className="custom-scrollbar min-h-0 min-w-0 w-full shrink-0 overflow-x-hidden overflow-y-auto lg:w-80 lg:max-w-[20rem]">
          <IssueDetailSidePanel
            issue={issue}
            onRefresh={onRefresh}
            statusSelectOptions={statusSelectOptions}
          />
        </div>
      </div>
    </div>
  );
});
