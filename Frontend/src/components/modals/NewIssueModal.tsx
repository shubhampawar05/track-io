"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { format, parse } from "date-fns";
import {
  Calendar as CalendarIcon,
  Info,
  Layers,
  Tag,
  User,
  X,
} from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import {
  dismissNewIssueGuide,
  isNewIssueGuideDismissed,
} from "@/lib/new-issue-guide-storage";
import type {
  NewIssueCreatePayload,
  Priority,
  ProjectCard,
  Status,
} from "@/types/issue";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { ISSUE_LABEL_OPTIONS } from "@/utils/issueLabels";
import { Skeleton } from "@/components/ui/Skeleton";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriorityMenuGlyph } from "@/components/issues/PriorityMenuGlyph";
import { StatusMenuGlyph } from "@/components/issues/StatusMenuGlyph";
import { statusSelectOptionsForProjectBoard } from "@/lib/issue-status-ui";
import { cn } from "@/lib/utils";
import {
  propertyRowClass,
  propertySelectContentClass,
  propertySelectItemClass,
  SELECT_NO_OPTIONS_MESSAGE,
} from "@/components/issues/detail/issueDetailPropertySelectStyles";

const UNASSIGNED_VALUE = "__unassigned__";

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "No Priority" },
];

const LABEL_DOT: Record<string, string> = {
  General: "#6b7280",
  Bug: "#ef4444",
  Feature: "#22c55e",
  Improvement: "#3b82f6",
  Docs: "#a855f7",
  Chore: "#ca8a04",
};

/** Display-only: hyphenated names → capitalized words (e.g. linear-architect). */
function formatProjectDisplayName(name: string): string {
  return name
    .split("-")
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function dueDateIsoFromInput(yyyymmdd: string): string | undefined {
  const t = yyyymmdd.trim();
  if (!t) return undefined;
  const d = new Date(`${t}T12:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

type NewIssueModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Resolves `true` on success; on `false` the modal stays open with the form intact. */
  onAdd: (payload: NewIssueCreatePayload) => Promise<boolean>;
  projectSlug: string | null;
  /** Pre-selected status (e.g. the board column the modal was opened from). */
  initialStatus?: Status | null;
  currentUserId: string | null;
};

/**
 * Form state lives in {@link NewIssueModalContent}, which is mounted only while open,
 * so every opening starts from a fresh form without reset effects.
 */
export function NewIssueModal({ isOpen, ...props }: NewIssueModalProps) {
  return (
    <AnimatePresence>
      {isOpen && <NewIssueModalContent key="new-issue" {...props} />}
    </AnimatePresence>
  );
}

function NewIssueModalContent({
  onClose,
  onAdd,
  projectSlug,
  initialStatus,
  currentUserId,
}: Omit<NewIssueModalProps, "isOpen">) {
  const isPresent = useIsPresent();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusChoice, setStatus] = useState<Status>(initialStatus ?? "todo");
  const [priority, setPriority] = useState<Priority>("medium");
  const [label, setLabel] =
    useState<(typeof ISSUE_LABEL_OPTIONS)[number]["value"]>("General");
  /** "" = default (assign to me); UNASSIGNED_VALUE = no assignee; else user id */
  const [assigneeValue, setAssigneeValue] = useState("");
  const [showGuide, setShowGuide] = useState(
    () => !isNewIssueGuideDismissed(currentUserId),
  );
  /** When parent did not pass a project slug, user picks from org projects */
  const [pickedProjectSlugChoice, setPickedProjectSlug] = useState("");
  const [dueDateInput, setDueDateInput] = useState("");
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const organizationId = useOrganizationStore((s) => s.organizationId);

  const projectsQuery = useQuery({
    queryKey: ["projects", organizationId],
    enabled: Boolean(!projectSlug && organizationId),
    queryFn: async ({ queryKey }) => {
      const r = await apiJson<ProjectCard[]>("/api/projects", { orgId: queryKey[1] });
      if (!r.success) throw new Error(r.error);
      return r.data;
    },
  });

  /** User's pick if still in the list, otherwise default to the first project. */
  const pickedProjectSlug = useMemo(() => {
    if (projectSlug) return "";
    const list = projectsQuery.data ?? [];
    if (list.length === 0) return "";
    return pickedProjectSlugChoice &&
      list.some((p) => p.slug === pickedProjectSlugChoice)
      ? pickedProjectSlugChoice
      : list[0].slug;
  }, [projectSlug, projectsQuery.data, pickedProjectSlugChoice]);

  const effectiveSlug = projectSlug ?? pickedProjectSlug;

  const {
    data: projectData,
    isPending: projectLoading,
    isError: projectError,
    error: projectLoadError,
  } = useProjectDetail(effectiveSlug);

  const project = effectiveSlug ? projectData : undefined;

  const statusSelectOptions = useMemo(
    () => statusSelectOptionsForProjectBoard(project?.boardColumns),
    [project?.boardColumns],
  );

  /** Fall back to "todo" (or the first column) when the chosen status isn't on this board. */
  const status: Status =
    statusSelectOptions.length === 0 ||
    statusSelectOptions.some((o) => o.value === statusChoice)
      ? statusChoice
      : (statusSelectOptions.find((o) => o.value === "todo")?.value ??
        statusSelectOptions[0].value);

  const resolveAssigneeIdForSubmit = useCallback(():
    | string
    | null
    | undefined => {
    if (!effectiveSlug) return undefined;
    if (assigneeValue === UNASSIGNED_VALUE) return null;
    if (assigneeValue === "") return undefined;
    return assigneeValue;
  }, [effectiveSlug, assigneeValue]);

  const assigneePreview = useMemo(() => {
    if (!effectiveSlug || !project || projectLoading) return null;
    if (assigneeValue === UNASSIGNED_VALUE) {
      return { initials: "—", name: "Unassigned" as string };
    }
    if (assigneeValue === "") {
      if (!currentUserId) return { initials: "?", name: "Assign to me" };
      const me = project.members.find((m) => m.id === currentUserId);
      return {
        initials: me?.initials ?? "?",
        name: me?.name ? `${me.name} (you)` : "You",
      };
    }
    const m = project.members.find((mm) => mm.id === assigneeValue);
    return {
      initials: m?.initials ?? "?",
      name: m?.name ?? "Member",
    };
  }, [assigneeValue, currentUserId, project, projectLoading, effectiveSlug]);

  const projectsLoading = Boolean(!projectSlug && projectsQuery.isLoading);
  const projectsListError = Boolean(!projectSlug && projectsQuery.isError);
  const projectListEmpty =
    !projectSlug && !projectsLoading && (projectsQuery.data?.length ?? 0) === 0;

  const canSubmitBase =
    Boolean(title.trim()) &&
    Boolean(effectiveSlug) &&
    !projectsLoading &&
    !projectsListError &&
    !projectListEmpty &&
    !(
      Boolean(projectSlug) &&
      (projectLoading || projectError)
    );

  const submitIssue = useCallback(async () => {
    if (!title.trim() || !effectiveSlug) return;
    if (projectSlug && (!projectData || projectLoading)) return;
    if (
      !projectSlug &&
      (projectsLoading || projectsListError || !pickedProjectSlug)
    )
      return;
    setBusy(true);
    try {
      const aid = resolveAssigneeIdForSubmit();
      const dueIso = dueDateIsoFromInput(dueDateInput);
      const payload: NewIssueCreatePayload = {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        label: label === "General" ? undefined : label,
        ...(aid === undefined ? {} : { assigneeId: aid }),
        projectSlug: projectSlug ?? effectiveSlug,
        ...(dueIso ? { dueDate: dueIso } : {}),
      };
      const ok = await onAdd(payload);
      if (!ok) return;
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setLabel("General");
      setAssigneeValue("");
      setDueDateInput("");
      onClose();
    } finally {
      setBusy(false);
    }
  }, [
    title,
    effectiveSlug,
    projectSlug,
    projectData,
    projectLoading,
    projectsLoading,
    projectsListError,
    pickedProjectSlug,
    description,
    status,
    priority,
    label,
    dueDateInput,
    onAdd,
    onClose,
    resolveAssigneeIdForSubmit,
  ]);

  useEffect(() => {
    if (!isPresent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (canSubmitBase && !busy) void submitIssue();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPresent, onClose, canSubmitBase, busy, submitIssue]);

  const headerLabel =
    effectiveSlug && project?.keyPrefix
      ? `${project.keyPrefix} / NEW ISSUE`
      : "NEW ISSUE";

  const inlineError = projectsListError
    ? "Could not load projects. Try again or refresh."
    : projectListEmpty
      ? "Create a project before adding issues."
      : projectSlug && projectError
        ? (projectLoadError?.message || "Could not load project.")
        : null;

  const dueDateParsed = useMemo(() => {
    const t = dueDateInput.trim();
    if (!t) return undefined;
    const d = parse(t, "yyyy-MM-dd", new Date());
    return Number.isNaN(d.getTime()) ? undefined : d;
  }, [dueDateInput]);

  const dueDateTriggerLabel = dueDateParsed
    ? format(dueDateParsed, "MMM d, yyyy")
    : "Due date (optional)";

  const statusLabel =
    statusSelectOptions.find((o) => o.value === status)?.label ?? status;
  const priorityLabel =
    PRIORITY_OPTIONS.find((o) => o.value === priority)?.label ?? priority;
  const labelOption = ISSUE_LABEL_OPTIONS.find((o) => o.value === label);

  const pickedProjectDisplayName = useMemo(() => {
    if (!pickedProjectSlug) return "";
    const match = (projectsQuery.data ?? []).find(
      (p) => p.slug === pickedProjectSlug,
    );
    return match?.name ?? "";
  }, [pickedProjectSlug, projectsQuery.data]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 20 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-issue-title"
        className="relative z-10 flex w-[960px] min-h-[580px] max-h-[min(92vh,880px)] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl dark:rounded-[12px] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1c1c28]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4 dark:border-[rgba(255,255,255,0.06)]">
          <div className="min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-widest text-linear-text-muted dark:text-[rgba(255,255,255,0.35)]">
              <Layers
                className="size-3.5 shrink-0 text-linear-accent dark:text-[rgba(255,255,255,0.35)]"
                aria-hidden
              />
              <span className="truncate">{headerLabel}</span>
            </div>
            {effectiveSlug && (project?.name ?? effectiveSlug) ? (
              <p className="truncate text-xs text-[var(--text)] dark:text-white">
                {formatProjectDisplayName(project?.name ?? effectiveSlug)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-linear-text-muted transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] dark:text-[rgba(255,255,255,0.45)] dark:hover:bg-[rgba(255,255,255,0.06)] dark:hover:text-white"
            aria-label="Close"
          >
            <X className="size-[18px]" strokeWidth={2} />
          </button>
        </header>

        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
          {inlineError ? (
            <p className="mb-4 text-sm text-red-400" role="alert">
              {inlineError}
            </p>
          ) : null}
          {showGuide ? (
            <div
              className="mb-4 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--hover)] p-4 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)]"
              role="region"
              aria-label="Create issue tips"
            >
              <div className="flex gap-2">
                <Info
                  className="mt-0.5 size-4 shrink-0 text-linear-accent dark:text-indigo-400"
                  aria-hidden
                />
                <div className="space-y-2 text-xs leading-relaxed text-linear-text-muted dark:text-[rgba(255,255,255,0.55)]">
                  <p className="font-medium text-[var(--text)] dark:text-white">
                    Quick guide
                  </p>
                  <ul className="list-disc space-y-1 pl-4">
                    <li>Title and description capture what needs doing.</li>
                    <li>
                      Status and priority help your board and filters.
                    </li>
                    <li>
                      Assign to yourself, leave unassigned, or pick a
                      teammate.
                    </li>
                    <li>
                      Label categorizes the work (Bug, Feature, and more).
                    </li>
                    <li>
                      Optional due date applies on create; you can change it
                      later in the sidebar.
                    </li>
                  </ul>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="linear-button-primary px-3 py-1.5 text-xs"
                  onClick={() => {
                    dismissNewIssueGuide(currentUserId);
                    setShowGuide(false);
                  }}
                >
                  Got it
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col gap-8 md:flex-row md:items-stretch md:gap-8">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
              {!projectSlug ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-linear-text-muted dark:text-[rgba(255,255,255,0.35)]">
                    Project
                  </p>
                  {projectsLoading ? (
                    <Skeleton className="h-9 w-full rounded-md" />
                  ) : (
                    <Select
                      modal={false}
                      disabled={projectListEmpty}
                      value={projectListEmpty ? null : pickedProjectSlug}
                      onValueChange={(v) => setPickedProjectSlug(v ?? "")}
                    >
                      <SelectTrigger
                        id="new-issue-project"
                        aria-label="Project"
                        className={cn(
                          propertyRowClass,
                          "h-9 w-full min-w-0 py-0 pr-2 pl-2.5 shadow-none focus-visible:ring-0 data-placeholder:text-linear-text-muted dark:data-placeholder:text-[rgba(255,255,255,0.35)]",
                        )}
                      >
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-left",
                            (projectListEmpty || !pickedProjectDisplayName) &&
                              "text-linear-text-muted dark:text-[rgba(255,255,255,0.35)]",
                          )}
                        >
                          {projectListEmpty
                            ? SELECT_NO_OPTIONS_MESSAGE
                            : pickedProjectDisplayName || "Select project"}
                        </span>
                        <SelectValue className="sr-only" />
                      </SelectTrigger>
                      <SelectContent
                        align="start"
                        className={cn(
                          propertySelectContentClass,
                          "w-(--anchor-width)",
                        )}
                      >
                        {projectListEmpty
                          ? null
                          : (projectsQuery.data ?? []).map((p) => (
                              <SelectItem
                                key={p.slug}
                                value={p.slug}
                                className={propertySelectItemClass}
                              >
                                {p.name}
                              </SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : null}
              <input
                id="new-issue-title"
                autoFocus
                type="text"
                placeholder="Issue title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full shrink-0 border-0 bg-transparent p-0 text-[22px] font-medium text-[var(--text)] placeholder:text-[var(--text-muted)] dark:text-white dark:placeholder:text-[rgba(255,255,255,0.25)] focus:outline-none focus:ring-0"
              />
              <textarea
                placeholder="Add description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-0 w-full flex-1 resize-y border-0 bg-transparent p-0 text-sm leading-relaxed text-[var(--text-muted)] placeholder:text-[var(--text-muted)] dark:text-[rgba(255,255,255,0.6)] dark:placeholder:text-[rgba(255,255,255,0.25)] focus:outline-none focus:ring-0"
              />
            </div>

            <div
              className="hidden w-px shrink-0 self-stretch bg-gray-200 dark:bg-[rgba(255,255,255,0.06)] md:block"
              aria-hidden
            />

            <aside className="w-full shrink-0 space-y-2 md:w-[240px]">
              <p className="pb-1 text-xs font-medium uppercase tracking-widest text-linear-text-muted dark:text-[rgba(255,255,255,0.35)]">
                Properties
              </p>
              <div className="flex flex-col gap-2">
                <Select
                  modal={false}
                  disabled={statusSelectOptions.length === 0}
                  value={statusSelectOptions.length === 0 ? null : status}
                  onValueChange={(v) => setStatus(v as Status)}
                >
                  <SelectTrigger
                    aria-label="Status"
                    className={cn(
                      propertyRowClass,
                      "w-full min-w-0 py-0 pr-2 pl-2.5 shadow-none focus-visible:ring-0 [&_svg]:text-linear-text-muted dark:[&_svg]:text-[rgba(255,255,255,0.45)]",
                    )}
                  >
                    <StatusMenuGlyph status={status} className="size-3.5" />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {statusLabel}
                    </span>
                    <SelectValue className="sr-only" />
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    className={propertySelectContentClass}
                  >
                    {statusSelectOptions.length === 0
                      ? null
                      : statusSelectOptions.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className={propertySelectItemClass}
                          >
                            <StatusMenuGlyph
                              status={option.value}
                              className="my-auto mr-1 size-3.5"
                            />
                            {option.label}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>

                <Select
                  modal={false}
                  value={priority}
                  onValueChange={(v) => setPriority(v as Priority)}
                >
                  <SelectTrigger
                    aria-label="Priority"
                    className={cn(
                      propertyRowClass,
                      "w-full min-w-0 py-0 pr-2 pl-2.5 shadow-none focus-visible:ring-0 [&_svg]:text-linear-text-muted dark:[&_svg]:text-[rgba(255,255,255,0.45)]",
                    )}
                  >
                    <PriorityMenuGlyph
                      priority={priority}
                      className="size-3.5"
                    />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {priorityLabel}
                    </span>
                    <SelectValue className="sr-only" />
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    className={propertySelectContentClass}
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className={propertySelectItemClass}
                      >
                        <PriorityMenuGlyph
                          priority={option.value}
                          className="my-auto mr-1 size-3.5"
                        />
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  modal={false}
                  value={label}
                  onValueChange={(v) =>
                    setLabel(
                      v as (typeof ISSUE_LABEL_OPTIONS)[number]["value"],
                    )
                  }
                >
                  <SelectTrigger
                    aria-label="Label"
                    className={cn(
                      propertyRowClass,
                      "w-full min-w-0 py-0 pr-2 pl-2.5 shadow-none focus-visible:ring-0 [&_svg]:text-linear-text-muted dark:[&_svg]:text-[rgba(255,255,255,0.45)]",
                    )}
                  >
                    <Tag className="size-4 shrink-0 text-linear-text-muted dark:text-[rgba(255,255,255,0.45)]" />
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: LABEL_DOT[label] ?? "#6b7280",
                      }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {labelOption?.label ?? label}
                    </span>
                    <SelectValue className="sr-only" />
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    className={propertySelectContentClass}
                  >
                    {ISSUE_LABEL_OPTIONS.map((o) => (
                      <SelectItem
                        key={o.value}
                        value={o.value}
                        className={propertySelectItemClass}
                      >
                        <span
                          className="size-2 my-auto mr-1 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              LABEL_DOT[o.value] ?? "#6b7280",
                          }}
                          aria-hidden
                        />
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {effectiveSlug ? (
                  projectLoading ? (
                    <div
                      className={cn(
                        propertyRowClass,
                        "pointer-events-none opacity-80",
                      )}
                      aria-busy
                      aria-label="Loading assignees"
                    >
                      <User className="size-4 shrink-0 text-linear-text-muted dark:text-[rgba(255,255,255,0.45)]" />
                      <Skeleton className="h-5 min-w-0 flex-1 rounded-md" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Select
                        modal={false}
                        value={assigneeValue}
                        onValueChange={(v) => setAssigneeValue(v ?? "")}
                      >
                        <SelectTrigger
                          aria-label="Assignee"
                          className={cn(
                            propertyRowClass,
                            "w-full min-w-0 py-0 pr-2 pl-2.5 shadow-none focus-visible:ring-0 [&_svg]:text-linear-text-muted dark:[&_svg]:text-[rgba(255,255,255,0.45)]",
                          )}
                        >
                          {assigneePreview?.name !== "Unassigned" ? (
                            <span className="flex min-w-0 flex-1 items-center gap-2 my-1">
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,#5e6ad2_14%,transparent)] text-[10px] font-bold text-[var(--text)] ring-1 ring-[color-mix(in_srgb,#5e6ad2_35%,transparent)] dark:bg-[color-mix(in_srgb,#5e6ad2_14%,transparent)] dark:text-white dark:ring-[color-mix(in_srgb,#5e6ad2_35%,transparent)]">
                                {assigneePreview?.initials}
                              </span>
                              <span className="truncate">
                                {assigneePreview?.name}
                              </span>
                            </span>
                          ) : (
                            <span className="truncate text-linear-text-muted dark:text-[rgba(255,255,255,0.45)]">
                              Unassigned
                            </span>
                          )}
                          <SelectValue className="sr-only" />
                        </SelectTrigger>
                        <SelectContent
                          align="start"
                          className={propertySelectContentClass}
                        >
                          <SelectItem
                            value=""
                            className={propertySelectItemClass}
                          >
                            Assign to me
                          </SelectItem>
                          <SelectItem
                            value={UNASSIGNED_VALUE}
                            className={propertySelectItemClass}
                          >
                            Unassigned
                          </SelectItem>
                          {(project?.members ?? [])
                            .filter((m) =>
                              currentUserId ? m.id !== currentUserId : true,
                            )
                            .map((m) => (
                              <SelectItem
                                key={m.id}
                                value={m.id}
                                className={propertySelectItemClass}
                              >
                                <span className="flex min-w-0 flex-1 items-center gap-2">
                                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,#5e6ad2_14%,transparent)] text-[10px] font-bold text-[var(--text)] ring-1 ring-[color-mix(in_srgb,#5e6ad2_35%,transparent)] dark:text-white">
                                    {m.initials}
                                  </span>
                                  <span className="truncate">{m.name}</span>
                                </span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                ) : null}

                <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                  <PopoverTrigger
                    type="button"
                    className={cn(
                      propertyRowClass,
                      "h-9 min-h-[36px] w-full cursor-pointer text-left text-[13px] shadow-none dark:bg-[rgba(255,255,255,0.04)] dark:text-white",
                      !dueDateParsed &&
                        "text-linear-text-muted dark:text-[rgba(255,255,255,0.35)]",
                    )}
                  >
                    <CalendarIcon
                      className="size-[14px] shrink-0 text-linear-text-muted dark:text-[rgba(255,255,255,0.45)]"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {dueDateTriggerLabel}
                    </span>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className={cn(
                      "w-auto border border-[var(--border)] bg-[var(--card)] p-2 text-[var(--text)] shadow-lg ring-0",
                      "dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1e1e2e] dark:text-white",
                    )}
                  >
                    <Calendar
                      mode="single"
                      selected={dueDateParsed}
                      onSelect={(d) => {
                        if (d) setDueDateInput(format(d, "yyyy-MM-dd"));
                        else setDueDateInput("");
                        setDueDateOpen(false);
                      }}
                      className={cn(
                        "rounded-md bg-transparent p-0 text-[var(--text)] [--cell-size:2rem]",
                        "dark:text-white",
                        "[&_button[data-day]:hover]:bg-[var(--hover)] dark:[&_button[data-day]:hover]:bg-[rgba(255,255,255,0.06)]",
                      )}
                      classNames={{
                        outside:
                          "text-[var(--text-muted)] dark:text-[rgba(255,255,255,0.35)]",
                        disabled:
                          "text-[var(--text-muted)]/70 opacity-50 dark:text-[rgba(255,255,255,0.25)]",
                        hidden: "invisible",
                        weekday:
                          "flex-1 rounded-md text-[0.75rem] font-normal text-[var(--text-muted)] dark:text-[rgba(255,255,255,0.45)]",
                      }}
                      modifiersClassNames={{
                        selected:
                          "[&_button]:!bg-[#5e6ad2] [&_button]:!text-white",
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </aside>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4 dark:border-[rgba(255,255,255,0.06)]">
          <span className="text-xs text-linear-text-muted dark:text-[rgba(255,255,255,0.3)]">
            Escape to close · ⌘/Ctrl+Enter to create
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-2 rounded-md text-linear-text-muted transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] dark:text-[rgba(255,255,255,0.5)] dark:hover:bg-[rgba(255,255,255,0.06)] dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !canSubmitBase}
              onClick={() => void submitIssue()}
              className="linear-button-primary h-9 px-4 text-sm disabled:opacity-50 dark:!bg-[#5e6ad2] dark:hover:!brightness-110"
            >
              Create Issue
            </button>
          </div>
        </footer>
      </motion.div>
    </div>
  );
}
