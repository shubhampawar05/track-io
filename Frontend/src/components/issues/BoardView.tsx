"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "motion/react";
import { ListFilter, Plus } from "lucide-react";
import { BoardColumn } from "@/components/issues/board/BoardColumn";
import { IssueCard } from "@/components/issues/IssueCard";
import type { Issue, Status } from "@/types/issue";
import {
  buildBoardItemMap,
  cloneBoardItemMap,
  computeBoardMoveUpdate,
  emptyBoardItemMap,
  findBoardItemContainer,
  type BoardReorderEntry,
} from "@/lib/issue-board-sort";
import { apiJson } from "@/lib/api-client";
import { projectDetailQueryKey } from "@/hooks/useProjectDetail";
import {
  PROTECTED_BOARD_STATUSES,
  slugifyColumnTitle,
  type BoardColumnConfig,
} from "@/lib/board-columns-storage";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { useUIStore } from "@/stores/useUIStore";
import { useModalDialog } from "@/hooks/useModalDialog";
import { IssueListTruncatedNotice, IssuePipelineFilterChipsRow } from "@/components/issues/ListView";
import { IssuesBoardSkeleton } from "@/components/issues/IssuesBoardSkeleton";
import { QueryErrorState } from "@/components/ui/QueryErrorState";
import { buildIssueDetailUrl } from "@/lib/issue-detail-from";
import type { ProjectDetail } from "@/types/issue";
import {
  buildIssuesListQueryString,
  type PipelineFilterState,
} from "@/hooks/useIssuesList";

const DEFAULT_COLUMNS: BoardColumnConfig[] = [
  { id: "col-backlog", title: "Backlog", status: "backlog" },
  { id: "col-todo", title: "Todo", status: "todo" },
  { id: "col-in-progress", title: "In Progress", status: "in-progress" },
  { id: "col-done", title: "Done", status: "done" },
];

function newColumnId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `col-${crypto.randomUUID()}`
    : `col-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function BoardView({
  issues,
  loading,
  error,
  onRetry,
  onBoardReorder,
  boardScope = "__global__",
  issueNavFrom = "board",
  issueNavProjectView = "board",
  appliedPipelineFilters,
  totalCount,
}: {
  issues: Issue[];
  /** Server-side match count; a notice is shown when it exceeds `issues.length`. */
  totalCount?: number;
  loading?: boolean;
  /** Load failure for `issues`; renders an error state instead of empty columns. */
  error?: unknown;
  onRetry?: () => void;
  /** Persist a single card move (status + sortOrder). */
  onBoardReorder: (update: BoardReorderEntry) => void | Promise<void>;
  /** Persist columns per org + scope (e.g. project slug or __global__). */
  boardScope?: string;
  /** Where "back" should go when opening an issue from this board. */
  issueNavFrom?: "board" | "list" | "project";
  issueNavProjectView?: "list" | "board";
  appliedPipelineFilters?: PipelineFilterState;
}) {
  const router = useRouter();
  const openNewIssueModal = useUIStore((s) => s.openNewIssueModal);
  const showToast = useUIStore((s) => s.showToast);
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const organizations = useAuthStore((s) => s.organizations);
  const queryClient = useQueryClient();
  const setFilterOpen = useUIStore((s) => s.setFilterOpen);

  const isGlobalBoard = boardScope === "__global__";

  const canManageBoard = useMemo(() => {
    if (!organizationId || !organizations.length) return false;
    const role = organizations.find((o) => o.id === organizationId)?.role;
    return role === "owner" || role === "admin";
  }, [organizationId, organizations]);

  /** Org + board scope the columns belong to; local edits and saves are always tied to it. */
  const scopeKey = `${organizationId ?? ""}::${boardScope}`;

  const columnsQuery = useQuery({
    queryKey: isGlobalBoard
      ? ["issuesBoardColumns", organizationId]
      : ["projectBoardColumns", organizationId, boardScope],
    enabled: Boolean(organizationId) && (isGlobalBoard || Boolean(boardScope)),
    queryFn: async ({ queryKey }) => {
      const orgId = queryKey[1] as string | null;
      if (isGlobalBoard) {
        const r = await apiJson<{ columns: BoardColumnConfig[] }>(
          "/api/organizations/issues-board-columns",
          { orgId },
        );
        if (!r.success) throw new Error(r.error);
        return r.data.columns;
      }
      const r = await apiJson<ProjectDetail>(
        `/api/projects/${encodeURIComponent(boardScope)}`,
        { orgId },
      );
      if (!r.success) throw new Error(r.error);
      return r.data.boardColumns;
    },
  });

  /**
   * Optimistic local edit awaiting save. Keyed by scope so switching project/org can never show
   * (or save) another board's columns; otherwise the server columns are rendered directly.
   */
  const [pendingColumns, setPendingColumns] = useState<{
    scope: string;
    cols: BoardColumnConfig[];
  } | null>(null);

  const columns: BoardColumnConfig[] =
    pendingColumns && pendingColumns.scope === scopeKey
      ? pendingColumns.cols
      : organizationId
        ? (columnsQuery.data ?? DEFAULT_COLUMNS)
        : DEFAULT_COLUMNS;

  type ColumnsSaveVars = {
    orgId: string;
    scope: string;
    isGlobal: boolean;
    cols: BoardColumnConfig[] | null;
  };

  const saveColumnsMutation = useMutation({
    mutationFn: async ({ orgId, scope, isGlobal, cols }: ColumnsSaveVars) => {
      if (isGlobal) {
        const r = await apiJson<{ columns: BoardColumnConfig[] }>("/api/organizations", {
          method: "PATCH",
          body: { issuesBoardColumns: cols },
          orgId,
        });
        if (!r.success) throw new Error(r.error);
        return { columns: r.data.columns, project: null as ProjectDetail | null };
      }
      const r = await apiJson<ProjectDetail>(`/api/projects/${encodeURIComponent(scope)}`, {
        method: "PATCH",
        body: { boardColumns: cols ?? DEFAULT_COLUMNS },
        orgId,
      });
      if (!r.success) throw new Error(r.error);
      return { columns: r.data.boardColumns, project: r.data };
    },
    onSuccess: (data, { orgId, scope, isGlobal }) => {
      if (isGlobal) {
        queryClient.setQueryData(["issuesBoardColumns", orgId], data.columns);
      } else {
        queryClient.setQueryData(["projectBoardColumns", orgId, scope], data.columns);
        if (data.project) {
          queryClient.setQueryData(projectDetailQueryKey(orgId, scope), data.project);
        }
        void queryClient.invalidateQueries({ queryKey: ["issuesBoardColumns", orgId] });
      }
    },
  });
  const saveColumns = saveColumnsMutation.mutate;

  /** Apply a column edit optimistically and persist it to the scope the columns came from. */
  const persistColumns = useCallback(
    (
      next: BoardColumnConfig[] | null,
      opts?: { successMessage?: string; errorMessage?: string },
    ) => {
      if (!organizationId || !canManageBoard) return;
      const scope = scopeKey;
      const pending = next ? { scope, cols: next } : null;
      if (pending) setPendingColumns(pending);
      const settle = () =>
        setPendingColumns((cur) => (cur === pending ? null : cur));
      saveColumns(
        { orgId: organizationId, scope: boardScope, isGlobal: isGlobalBoard, cols: next },
        {
          onSuccess: () => {
            settle();
            if (opts?.successMessage) showToast(opts.successMessage);
          },
          onError: () => {
            settle();
            showToast(opts?.errorMessage ?? "Could not save board columns", "error");
          },
        },
      );
    },
    [
      organizationId,
      canManageBoard,
      scopeKey,
      saveColumns,
      boardScope,
      isGlobalBoard,
      showToast,
    ],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  const previewStatus = useMemo(() => slugifyColumnTitle(addTitle), [addTitle]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const columnStatuses = useMemo(() => columns.map((c) => c.status), [columns]);

  const [items, setItems] = useState<Record<string, string[]>>({});
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem("last-opened-issue");
    } catch {
      return null;
    }
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const itemsRef = useRef(items);
  const draggingBoardRef = useRef(false);
  const dragBaselineMapRef = useRef<Record<string, string[]> | null>(null);
  const baselineIssuesRef = useRef<Issue[]>([]);
  const issuesPropRef = useRef(issues);

  useLayoutEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    issuesPropRef.current = issues;
  }, [issues]);

  const handleIssueNavigate = useCallback(
    (issue: Issue) => {
      setLastOpenedId(issue.id);
      sessionStorage.setItem("last-opened-issue", issue.id);
      const inProject = boardScope !== "__global__";
      const url = buildIssueDetailUrl(issue.id, {
        from: inProject ? "project" : issueNavFrom,
        projectSlug: inProject ? boardScope : null,
        projectView: inProject ? issueNavProjectView : undefined,
      });
      router.push(url);
    },
    [boardScope, issueNavFrom, issueNavProjectView, router],
  );

  useEffect(() => {
    if (draggingBoardRef.current) return;
    setItems({
      ...emptyBoardItemMap(columnStatuses),
      ...buildBoardItemMap(issues, columnStatuses),
    });
  }, [issues, columnStatuses]);

  const issueMap = useMemo(
    () => new Map(issues.map((i) => [i.id, i])),
    [issues],
  );
  const activeIssue = useMemo(
    () => (activeId ? (issueMap.get(activeId) ?? null) : null),
    [activeId, issueMap],
  );

  const resetColumns = useCallback(() => {
    if (!canManageBoard) return;
    if (isGlobalBoard) {
      persistColumns(null, {
        successMessage: "Issues board reset — columns now follow all projects (merged)",
        errorMessage: "Could not reset columns",
      });
    } else {
      persistColumns(DEFAULT_COLUMNS, {
        successMessage: "Board columns reset to default",
        errorMessage: "Could not reset columns",
      });
    }
  }, [canManageBoard, isGlobalBoard, persistColumns]);

  const submitAddColumn = useCallback(() => {
    const title = addTitle.trim();
    if (!title) {
      showToast("Enter a column title", "error");
      return;
    }
    const status = slugifyColumnTitle(title) as Status;
    if (columns.some((c) => c.status === status)) {
      showToast("A column with that status already exists", "error");
      return;
    }
    persistColumns([...columns, { id: newColumnId(), title, status }], {
      successMessage: "Column added",
    });
    setAddTitle("");
    setAddOpen(false);
  }, [addTitle, columns, persistColumns, showToast]);

  const submitRename = useCallback(() => {
    const title = renameTitle.trim();
    if (!renameId || !title) {
      showToast("Enter a title", "error");
      return;
    }
    persistColumns(
      columns.map((c) => (c.id === renameId ? { ...c, title } : c)),
      { successMessage: "Column renamed" },
    );
    setRenameId(null);
    setRenameTitle("");
  }, [renameId, renameTitle, columns, persistColumns, showToast]);

  const [removingColumnId, setRemovingColumnId] = useState<string | null>(null);

  const removeColumn = useCallback(
    async (id: string) => {
      const col = columns.find((c) => c.id === id);
      if (!col || !organizationId) return;
      if (PROTECTED_BOARD_STATUSES.has(String(col.status))) {
        showToast("Cannot remove a default column", "error");
        return;
      }
      const status = String(col.status);
      const blockedMessage = (n: number | null) =>
        `“${col.title}” still has ${n == null ? "issues" : `${n} issue${n === 1 ? "" : "s"}`} — move them to another column before removing it`;

      // Visible cards may be a filtered subset, so also ask the server for every issue in this
      // board's scope with this status before allowing the column (and its issues) to disappear.
      const visible = issues.filter((i) => i.status === status).length;
      if (visible > 0) {
        showToast(blockedMessage(visible), "error");
        return;
      }
      setRemovingColumnId(id);
      try {
        const q = buildIssuesListQueryString({
          status: [status],
          priority: [],
          label: [],
          assignee: [],
        });
        const path = isGlobalBoard
          ? `/api/issues${q}`
          : `/api/projects/${encodeURIComponent(boardScope)}/issues${q}`;
        const r = await apiJson<Issue[]>(path, { orgId: organizationId });
        if (!r.success) {
          showToast("Could not check this column’s issues — try again", "error");
          return;
        }
        const total = r.data.filter((i) => i.status === status).length;
        if (total > 0) {
          showToast(blockedMessage(total), "error");
          return;
        }
      } finally {
        setRemovingColumnId(null);
      }
      persistColumns(
        columns.filter((c) => c.id !== id),
        { successMessage: `Removed “${col.title}”` },
      );
    },
    [columns, organizationId, issues, isGlobalBoard, boardScope, persistColumns, showToast],
  );

  const closeAddDialog = useCallback(() => {
    setAddOpen(false);
    setAddTitle("");
  }, []);
  const closeRenameDialog = useCallback(() => {
    setRenameId(null);
    setRenameTitle("");
  }, []);
  const addDialogRef = useModalDialog<HTMLFormElement>(addOpen, closeAddDialog);
  const renameDialogRef = useModalDialog<HTMLFormElement>(
    renameId !== null,
    closeRenameDialog,
  );

  const openRename = useCallback(
    (id: string) => {
      const col = columns.find((c) => c.id === id);
      if (!col) return;
      setRenameTitle(col.title);
      setRenameId(id);
    },
    [columns],
  );

  const onDragStart = useCallback((e: DragStartEvent) => {
    draggingBoardRef.current = true;
    dragBaselineMapRef.current = cloneBoardItemMap(itemsRef.current);
    baselineIssuesRef.current = issuesPropRef.current.map((i) => ({ ...i }));
    setActiveId(String(e.active.id));
  }, []);

  const onDragCancel = useCallback(() => {
    if (dragBaselineMapRef.current) {
      setItems(dragBaselineMapRef.current);
    }
    dragBaselineMapRef.current = null;
    draggingBoardRef.current = false;
    setActiveId(null);
  }, []);

  const onDragOver = useCallback(({ active, over }: DragOverEvent) => {
    const overId = over?.id;
    if (overId == null) return;

    const prev = itemsRef.current;
    const overContainer = findBoardItemContainer(overId, prev);
    const activeContainer = findBoardItemContainer(active.id, prev);
    if (!overContainer || !activeContainer || activeContainer === overContainer)
      return;

    setItems((current) => {
      const overItems = current[overContainer];
      const activeItems = current[activeContainer];
      const overIndex = overItems.indexOf(String(overId));
      const activeIndex = activeItems.indexOf(String(active.id));

      let newIndex: number;
      if (String(overId) in current) {
        newIndex = overItems.length + 1;
      } else {
        const isBelowOverItem =
          over &&
          active.rect.current.translated &&
          active.rect.current.translated.top > over.rect.top + over.rect.height;
        const modifier = isBelowOverItem ? 1 : 0;
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
      }

      return {
        ...current,
        [activeContainer]: current[activeContainer].filter(
          (item) => item !== String(active.id),
        ),
        [overContainer]: [
          ...current[overContainer].slice(0, newIndex),
          current[activeContainer][activeIndex],
          ...current[overContainer].slice(
            newIndex,
            current[overContainer].length,
          ),
        ],
      };
    });
  }, []);

  const onDragEnd = useCallback(
    async (e: DragEndEvent) => {
      const { active, over } = e;
      setActiveId(null);

      if (!over) {
        if (dragBaselineMapRef.current) setItems(dragBaselineMapRef.current);
        dragBaselineMapRef.current = null;
        draggingBoardRef.current = false;
        return;
      }

      const prev = cloneBoardItemMap(itemsRef.current);
      const overId = over.id;
      const overContainer = findBoardItemContainer(overId, prev);
      if (!overContainer) {
        dragBaselineMapRef.current = null;
        draggingBoardRef.current = false;
        return;
      }

      const activeIdx = prev[overContainer].indexOf(String(active.id));
      if (activeIdx === -1) {
        dragBaselineMapRef.current = null;
        draggingBoardRef.current = false;
        return;
      }

      let next = prev;
      if (!(String(overId) in prev)) {
        const overIdx = prev[overContainer].indexOf(String(overId));
        if (overIdx !== -1 && activeIdx !== overIdx) {
          next = {
            ...prev,
            [overContainer]: arrayMove(prev[overContainer], activeIdx, overIdx),
          };
        }
      }

      setItems(next);
      const snapshotForRevert = dragBaselineMapRef.current;
      dragBaselineMapRef.current = null;
      const update = snapshotForRevert
        ? computeBoardMoveUpdate(
            baselineIssuesRef.current,
            snapshotForRevert,
            next,
            String(active.id),
          )
        : null;

      try {
        if (update) {
          await onBoardReorder(update);
        }
      } catch {
        showToast("Could not save board order", "error");
        if (snapshotForRevert) setItems(snapshotForRevert);
      } finally {
        draggingBoardRef.current = false;
      }
    },
    [onBoardReorder, showToast],
  );

  const columnsLoading = Boolean(organizationId) && columnsQuery.isPending;

  if (loading || columnsLoading) {
    return <IssuesBoardSkeleton />;
  }

  if (error || columnsQuery.isError) {
    return (
      <div className="w-full min-w-0 p-6">
        <QueryErrorState
          message={error ? "Could not load issues." : "Could not load board columns."}
          error={error ?? columnsQuery.error}
          onRetry={() => {
            if (error) onRetry?.();
            if (columnsQuery.isError) void columnsQuery.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={(ev) => void onDragEnd(ev)}
      onDragCancel={onDragCancel}
    >
      <div className="w-full min-w-0 gap-6 p-6 h-[calc(100vh-3.5rem)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Issue Pipeline</h2>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-(--border) rounded-md text-xs text-linear-text-muted hover:text-(--text) transition-all duration-200"
          >
            <ListFilter className="w-3.5 h-3.5" />
            Filters
          </button>
        </div>
        {appliedPipelineFilters ? (
          <IssuePipelineFilterChipsRow applied={appliedPipelineFilters} />
        ) : null}
        <IssueListTruncatedNotice shown={issues.length} total={totalCount} />
        <div className="flex w-full min-w-0 gap-6 h-[calc(100vh-3.5rem)] overflow-x-auto custom-scrollbar">
          {columns.map((col) => (
            <BoardColumn
              key={col.id}
              col={col}
              itemIds={items[col.status] ?? []}
              issueMap={issueMap}
              lastOpenedId={lastOpenedId}
              onIssueNavigate={handleIssueNavigate}
              onNewIssue={() =>
                openNewIssueModal(isGlobalBoard ? null : boardScope, col.status)
              }
              canManageColumn={canManageBoard}
              onRenameColumn={() => openRename(col.id)}
              onRemoveColumn={() => {
                if (removingColumnId) return;
                void removeColumn(col.id);
              }}
            />
          ))}
          {canManageBoard && (
            <div className="w-80 min-w-[320px] flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="w-full py-4 border border-dashed border-(--border) rounded-xl text-sm text-linear-text-muted hover:text-(--text) hover:border-linear-accent/50 transition-all duration-200 flex items-center justify-center gap-2 bg-white/5"
              >
                <Plus className="w-4 h-4" />
                Add Column
              </button>
              <button
                type="button"
                onClick={resetColumns}
                className="text-[10px] font-bold uppercase tracking-widest text-linear-text-muted hover:text-linear-accent transition-colors duration-200"
              >
                Reset columns to default
              </button>
            </div>
          )}
        </div>
      </div>

      <DragOverlay
        zIndex={100}
        dropAnimation={{ duration: 200, easing: "ease" }}
      >
        {activeIssue ? (
          <div className="w-80 min-w-[320px] pointer-events-none cursor-grabbing opacity-95">
            <IssueCard issue={activeIssue} onClick={() => {}} interactive={false} />
          </div>
        ) : null}
      </DragOverlay>

      <AnimatePresence>
        {addOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAddOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.form
              ref={addDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="board-add-column-title"
              onSubmit={(e) => {
                e.preventDefault();
                void submitAddColumn();
              }}
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-md bg-(--card) border border-(--border) rounded-xl shadow-2xl p-6 space-y-4"
            >
              <h3 id="board-add-column-title" className="text-sm font-semibold">
                Add column
              </h3>
              <p className="text-xs text-linear-text-muted">
                Issue status saved to the server will match the slug below. Drag
                cards into this column to set that status.
              </p>
              <div className="space-y-2">
                <label
                  htmlFor="board-add-column-input"
                  className="text-[10px] font-bold text-linear-text-muted uppercase tracking-widest"
                >
                  Title
                </label>
                <input
                  id="board-add-column-input"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder="e.g. Review"
                  className="w-full bg-white/5 border border-(--border) rounded-md px-3 py-2 text-sm focus:outline-none focus:border-linear-accent"
                />
                <p className="text-[10px] text-linear-text-muted">
                  Status key:{" "}
                  <span className="font-mono text-(--text)">
                    {previewStatus || "…"}
                  </span>
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAddDialog}
                  className="px-3 py-1.5 text-sm text-linear-text-muted hover:text-(--text)"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-sm rounded-md bg-linear-accent text-primary-foreground hover:brightness-110"
                >
                  Add
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {renameId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeRenameDialog}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.form
              ref={renameDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="board-rename-column-title"
              onSubmit={(e) => {
                e.preventDefault();
                submitRename();
              }}
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-md bg-(--card) border border-(--border) rounded-xl shadow-2xl p-6 space-y-4"
            >
              <h3 id="board-rename-column-title" className="text-sm font-semibold">
                Rename column
              </h3>
              <div className="space-y-2">
                <label
                  htmlFor="board-rename-column-input"
                  className="text-[10px] font-bold text-linear-text-muted uppercase tracking-widest"
                >
                  Title
                </label>
                <input
                  id="board-rename-column-input"
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  className="w-full bg-white/5 border border-(--border) rounded-md px-3 py-2 text-sm focus:outline-none focus:border-linear-accent"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeRenameDialog}
                  className="px-3 py-1.5 text-sm text-linear-text-muted hover:text-(--text)"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-sm rounded-md bg-linear-accent text-primary-foreground hover:brightness-110"
                >
                  Save
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </DndContext>
  );
}
