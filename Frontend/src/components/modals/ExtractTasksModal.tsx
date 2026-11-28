"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  FileText,
  Mic,
  Pause,
  Sparkles,
  Square,
  Upload,
  X,
} from "lucide-react";
import { apiJson, apiUploadForm } from "@/lib/api-client";
import type { ProjectCard, TranscriptionCandidate } from "@/types/issue";
import { useRecordingSessionStore } from "@/stores/useRecordingSessionStore";
import { useUIStore } from "@/stores/useUIStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  propertyRowClass,
  propertySelectContentClass,
  propertySelectItemClass,
  SELECT_NO_OPTIONS_MESSAGE,
} from "@/components/issues/detail/issueDetailPropertySelectStyles";

type CandidateState = TranscriptionCandidate & { selected: boolean };

function toFormData(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return fd;
}

function formatDuration(ms: number) {
  const m = Math.floor(ms / 60000)
    .toString()
    .padStart(2, "0");
  const s = Math.floor((ms % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function ExtractTasksModal({
  isOpen,
  onClose,
  projects,
  onDone,
  initialTab,
}: {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectCard[];
  onDone: () => Promise<void>;
  initialTab: "paste" | "record";
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<CandidateState[]>([]);
  const [projectSlug, setProjectSlug] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const showToast = useUIStore((s) => s.showToast);
  const transcriptionSeedCandidates = useUIStore(
    (s) => s.transcriptionSeedCandidates,
  );

  const [activeTab, setActiveTab] = useState<"paste" | "record">("paste");

  // Sync local state to props/store during render (not in effects): switch to the requested
  // tab each time the modal opens, and load transcription candidates once per seed.
  const openTabKey = isOpen ? initialTab : null;
  const [prevOpenTabKey, setPrevOpenTabKey] = useState<typeof openTabKey>(null);
  if (openTabKey !== prevOpenTabKey) {
    setPrevOpenTabKey(openTabKey);
    if (openTabKey) setActiveTab(openTabKey);
  }
  const [consumedSeed, setConsumedSeed] =
    useState<typeof transcriptionSeedCandidates>(null);
  if (
    isOpen &&
    transcriptionSeedCandidates &&
    transcriptionSeedCandidates.length > 0 &&
    transcriptionSeedCandidates !== consumedSeed
  ) {
    setConsumedSeed(transcriptionSeedCandidates);
    setCandidates(
      transcriptionSeedCandidates.map((c) => ({ ...c, selected: true })),
    );
  }

  const phase = useRecordingSessionStore((s) => s.phase);
  const durationMs = useRecordingSessionStore((s) => s.durationMs);
  const isPaused = useRecordingSessionStore((s) => s.isPaused);
  const audioBlob = useRecordingSessionStore((s) => s.audioBlob);
  const startRecording = useRecordingSessionStore((s) => s.startRecording);
  const pauseOrResume = useRecordingSessionStore((s) => s.pauseOrResume);
  const stopRecording = useRecordingSessionStore((s) => s.stopRecording);
  const discardSession = useRecordingSessionStore((s) => s.discardSession);
  const uploadAndExtract = useRecordingSessionStore((s) => s.uploadAndExtract);

  const recording = phase === "capturing";
  const uploadBusy = phase === "uploading";
  const startingRecording = phase === "starting";

  const durationLabel = useMemo(() => formatDuration(durationMs), [durationMs]);

  const selectedCount = useMemo(
    () => candidates.filter((c) => c.selected).length,
    [candidates],
  );

  const hasProjects = projects.length > 0;

  const projectDisplayName = useMemo(() => {
    if (!projectSlug) return "";
    return projects.find((p) => p.slug === projectSlug)?.name ?? "";
  }, [projectSlug, projects]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (activeTab === "paste") {
        onClose();
        return;
      }
      if (uploadBusy) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, activeTab, onClose, uploadBusy]);

  async function extractWithText() {
    const value = text.trim();
    if (!value) {
      showToast("Paste transcription text first", "error");
      return;
    }
    setBusy(true);
    try {
      const r = await apiJson<{ candidates: TranscriptionCandidate[] }>(
        "/api/transcriptions/extract",
        {
          method: "POST",
          body: { text: value },
        },
      );
      if (!r.success) {
        showToast(r.error, "error");
        return;
      }
      setCandidates(r.data.candidates.map((c) => ({ ...c, selected: true })));
    } finally {
      setBusy(false);
    }
  }

  async function extractWithFile(file: File) {
    setBusy(true);
    try {
      const payload = await apiUploadForm<{
        candidates: TranscriptionCandidate[];
      }>("/api/transcriptions/extract", toFormData(file));
      if (!payload.success) {
        showToast(payload.error, "error");
        return;
      }
      setCandidates(
        payload.data.candidates.map((c) => ({ ...c, selected: true })),
      );
    } catch {
      showToast("Failed to parse transcription", "error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function createIssues() {
    if (!projectSlug) {
      showToast("Select a project first", "error");
      return;
    }
    const items = candidates
      .filter((c) => c.selected && c.title.trim())
      .map((c) => ({
        title: c.title.trim(),
        description: c.description.trim(),
        priority: c.priority,
        dueDate: c.dueDate,
      }));
    if (items.length === 0) {
      showToast("No selected tasks to create", "error");
      return;
    }
    setBusy(true);
    try {
      const r = await apiJson<{
        created: Array<{ id: string }>;
        skipped: Array<{ reason: string }>;
      }>("/api/transcriptions/create-issues", {
        method: "POST",
        body: { projectSlug, items },
      });
      if (!r.success) {
        showToast(r.error, "error");
        return;
      }
      await onDone();
      const skipped = r.data.skipped.length;
      showToast(
        skipped > 0
          ? `Created ${r.data.created.length}, skipped ${skipped}`
          : `Created ${r.data.created.length} tasks`,
      );
      onClose();
      setCandidates([]);
      setText("");
    } finally {
      setBusy(false);
    }
  }

  function dismissModalOnly() {
    if (uploadBusy) return;
    onClose();
  }

  function confirmDiscardIfNeeded(): boolean {
    if (phase === "capturing") {
      return window.confirm("Discard this recording? The microphone will stop.");
    }
    if (phase === "stopped" && audioBlob) {
      return window.confirm("Discard this recording?");
    }
    return true;
  }

  function handleCancel() {
    if (uploadBusy) return;
    if (!confirmDiscardIfNeeded()) return;
    discardSession();
    onClose();
  }

  function handleBackdropClick() {
    if (activeTab === "paste") {
      onClose();
    } else {
      dismissModalOnly();
    }
  }

  function handleHeaderClose() {
    if (activeTab === "paste") {
      onClose();
    } else {
      dismissModalOnly();
    }
  }

  const tabPillBtn =
    "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-[background,color] duration-150 ease-out";

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleBackdropClick}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 20 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="extract-tasks-title"
            className="relative z-10 flex min-h-[540px] w-[600px] max-h-[min(92vh,880px)] flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--card)] shadow-2xl dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1e1e2e]"
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-5 py-4 dark:border-[rgba(255,255,255,0.06)] dark:bg-[#1e1e2e]">
              <div className="flex min-w-0 items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-widest text-linear-text-muted dark:text-[rgba(255,255,255,0.35)]">
                <Sparkles
                  className="size-3.5 shrink-0 text-linear-accent dark:text-[rgba(255,255,255,0.35)]"
                  aria-hidden
                />
                <span id="extract-tasks-title" className="truncate">
                  EXTRACT TASKS
                </span>
              </div>
              <button
                type="button"
                disabled={activeTab === "record" && uploadBusy}
                onClick={handleHeaderClose}
                className="shrink-0 rounded-md p-1 text-linear-text-muted transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50 dark:text-[rgba(255,255,255,0.45)] dark:hover:bg-[rgba(255,255,255,0.06)] dark:hover:text-white"
                aria-label="Close"
              >
                <X className="size-[18px]" strokeWidth={2} />
              </button>
            </header>

            <div className="shrink-0 space-y-2 border-b border-[var(--border)] bg-[var(--card)] px-5 pb-4 pt-0 dark:border-[rgba(255,255,255,0.06)] dark:bg-[#1e1e2e]">
              <p className="pt-2 text-xs font-medium uppercase tracking-widest text-linear-text-muted dark:text-[rgba(255,255,255,0.35)]">
                Project
              </p>
              <Select
                modal={false}
                disabled={!hasProjects}
                value={hasProjects ? projectSlug : null}
                onValueChange={(v) => setProjectSlug(v ?? "")}
              >
                <SelectTrigger
                  id="extract-tasks-project"
                  aria-label="Project"
                  className={cn(
                    propertyRowClass,
                    "h-9 w-full min-w-0 py-0 pr-2 pl-2.5 shadow-none focus-visible:ring-0 data-placeholder:text-linear-text-muted dark:data-placeholder:text-[rgba(255,255,255,0.35)]",
                  )}
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-left",
                      (!projectDisplayName || !hasProjects) &&
                        "text-linear-text-muted dark:text-[rgba(255,255,255,0.35)]",
                    )}
                  >
                    {!hasProjects
                      ? SELECT_NO_OPTIONS_MESSAGE
                      : projectDisplayName || "Select project"}
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
                  {hasProjects
                    ? projects.map((p) => (
                        <SelectItem
                          key={p.slug}
                          value={p.slug}
                          className={propertySelectItemClass}
                        >
                          {p.name}
                        </SelectItem>
                      ))
                    : null}
                </SelectContent>
              </Select>
            </div>

            <div className="shrink-0 bg-[var(--card)] px-5 pb-4 pt-3 dark:bg-[#1e1e2e]">
              <div className="flex w-full gap-1 rounded-lg bg-black/[0.04] p-1 dark:bg-[rgba(255,255,255,0.04)]">
                <button
                  type="button"
                  onClick={() => setActiveTab("paste")}
                  className={cn(
                    tabPillBtn,
                    activeTab === "paste"
                      ? "bg-[var(--hover)] text-[var(--text)] dark:bg-[rgba(255,255,255,0.08)] dark:text-white"
                      : "bg-transparent text-[var(--text-muted)] dark:text-[rgba(255,255,255,0.4)]",
                  )}
                >
                  <FileText className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">Paste Transcript</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("record")}
                  className={cn(
                    tabPillBtn,
                    activeTab === "record"
                      ? "bg-[var(--hover)] text-[var(--text)] dark:bg-[rgba(255,255,255,0.08)] dark:text-white"
                      : "bg-transparent text-[var(--text-muted)] dark:text-[rgba(255,255,255,0.4)]",
                  )}
                >
                  <Mic className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">Record Meeting</span>
                </button>
              </div>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-[var(--card)] px-5 pb-5 dark:bg-[#1e1e2e]">
              <div className={activeTab === "paste" ? "block" : "hidden"}>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-linear-text-muted dark:text-[rgba(255,255,255,0.35)]">
                    Paste Transcript Text
                  </p>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste call transcription here..."
                    className="w-full min-h-[140px] rounded-md border border-[var(--border)] bg-[var(--hover)] p-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-0 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)] dark:text-white dark:placeholder:text-[rgba(255,255,255,0.25)]"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void extractWithText()}
                      className="linear-button-primary h-9 px-4 text-sm disabled:opacity-50 dark:!bg-[#5e6ad2] dark:hover:!brightness-110"
                    >
                      Extract from text
                    </button>
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".txt,text/plain"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void extractWithFile(file);
                      }}
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => inputRef.current?.click()}
                      className="flex h-9 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--hover)] px-3 text-xs text-[var(--text)] transition-colors hover:bg-muted disabled:opacity-50 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)] dark:text-white dark:hover:border-[rgba(255,255,255,0.15)] dark:hover:bg-[rgba(255,255,255,0.06)]"
                    >
                      <Upload className="size-3.5 shrink-0 opacity-70" />
                      Upload .txt
                    </button>
                  </div>
                </div>

                {candidates.length > 0 ? (
                  <div className="mt-5 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-widest text-linear-text-muted dark:text-[rgba(255,255,255,0.35)]">
                      Candidates ({selectedCount}/{candidates.length} selected)
                    </p>
                    <div className="space-y-2">
                      {candidates.map((item) => (
                        <div
                          key={item.clientId}
                          className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--hover)] p-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)]"
                        >
                          <label className="flex items-center gap-2 text-xs text-[var(--text)] dark:text-[rgba(255,255,255,0.75)]">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(e) =>
                                setCandidates((prev) =>
                                  prev.map((c) =>
                                    c.clientId === item.clientId
                                      ? { ...c, selected: e.target.checked }
                                      : c,
                                  ),
                                )
                              }
                              className="rounded border-[var(--border)] dark:border-[rgba(255,255,255,0.2)]"
                            />
                            Include
                          </label>
                          <input
                            value={item.title}
                            onChange={(e) =>
                              setCandidates((prev) =>
                                prev.map((c) =>
                                  c.clientId === item.clientId
                                    ? { ...c, title: e.target.value }
                                    : c,
                                ),
                              )
                            }
                            className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 text-sm text-[var(--text)] focus:outline-none focus:ring-0 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)] dark:text-white"
                          />
                          <textarea
                            value={item.description}
                            onChange={(e) =>
                              setCandidates((prev) =>
                                prev.map((c) =>
                                  c.clientId === item.clientId
                                    ? { ...c, description: e.target.value }
                                    : c,
                                ),
                              )
                            }
                            className="min-h-[70px] w-full rounded-md border border-[var(--border)] bg-[var(--card)] p-2 text-xs leading-relaxed text-[var(--text-muted)] focus:outline-none focus:ring-0 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)] dark:text-[rgba(255,255,255,0.85)]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className={activeTab === "record" ? "block" : "hidden"}>
                <div className="space-y-4">
                  <p className="text-xs text-linear-text-muted dark:text-[rgba(255,255,255,0.45)]">
                    You can close this window while recording; use the recording
                    chip in the top bar to reopen.
                  </p>
                  <div className="flex items-center justify-between rounded-lg border border-[var(--border)] p-4 dark:border-[rgba(255,255,255,0.08)]">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-linear-text-muted dark:text-[rgba(255,255,255,0.45)]">
                        Duration
                      </p>
                      <p className="text-lg font-semibold text-[var(--text)] dark:text-white">
                        {durationLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!recording ? (
                        <button
                          type="button"
                          disabled={uploadBusy || startingRecording}
                          onClick={() => void startRecording()}
                          className="linear-button-primary flex items-center gap-2"
                        >
                          <Mic className="h-4 w-4" />
                          {startingRecording ? "Starting…" : "Start"}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={pauseOrResume}
                            className="rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--text)] dark:border-[rgba(255,255,255,0.08)] dark:text-white"
                          >
                            <Pause className="mr-1 inline h-3 w-3" />
                            {isPaused ? "Resume" : "Pause"}
                          </button>
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--text)] dark:border-[rgba(255,255,255,0.08)] dark:text-white"
                          >
                            <Square className="mr-1 inline h-3 w-3" />
                            Stop
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {audioBlob ? (
                    <div className="text-xs text-linear-text-muted dark:text-[rgba(255,255,255,0.45)]">
                      Recording ready ({Math.ceil(audioBlob.size / 1024)} KB)
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--card)] px-5 py-4 dark:border-[rgba(255,255,255,0.06)] dark:bg-[#1e1e2e]">
              <span className="text-xs text-linear-text-muted dark:text-[rgba(255,255,255,0.3)]">
                Escape to close
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    activeTab === "record"
                      ? handleCancel()
                      : onClose()
                  }
                  className="h-9 rounded-md px-3 text-xs text-linear-text-muted transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] dark:text-[rgba(255,255,255,0.5)] dark:hover:bg-[rgba(255,255,255,0.06)] dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    activeTab === "paste"
                      ? busy || candidates.length === 0
                      : uploadBusy || recording || !audioBlob
                  }
                  onClick={() =>
                    activeTab === "paste"
                      ? void createIssues()
                      : void uploadAndExtract()
                  }
                  className="linear-button-primary h-9 rounded-md px-4 text-sm disabled:opacity-50 dark:!bg-[#5e6ad2] dark:hover:!brightness-110"
                >
                  {activeTab === "record" && uploadBusy
                    ? "Processing..."
                    : "Extract Tasks"}
                </button>
              </div>
            </footer>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
