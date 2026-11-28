"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { Bell, Moon, Pause, Play, Plus, Sparkles, Sun } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { useUIStore } from "@/stores/useUIStore";
import { useRecordingSessionStore } from "@/stores/useRecordingSessionStore";
import { isIssueDetailPath } from "@/utils/isIssueDetailPath";
import { safeDecodeURIComponent } from "@/lib/utils";
import { ThemePrimaryDevPicker } from "@/components/theme/ThemePrimaryDevPicker";

type ActiveSprintDto = { id: string; name: string } | null;

function isIssuesListOrBoard(pathname: string): boolean {
  return pathname === "/issues/list" || pathname === "/issues/board";
}

function contextSubtitle(pathname: string, sprintName: string | null): string {
  if (isIssuesListOrBoard(pathname)) {
    return sprintName ?? "All issues";
  }
  if (isIssueDetailPath(pathname)) {
    return sprintName ?? "Issue";
  }
  if (pathname === "/projects" || pathname === "/projects/") {
    return "All projects";
  }
  if (pathname.startsWith("/projects/")) {
    return "Project workspace";
  }
  if (pathname.startsWith("/settings")) {
    return "Settings";
  }
  if (pathname.startsWith("/my-issues")) {
    return "Assigned to you";
  }
  if (pathname.startsWith("/onboarding")) {
    return "Get started";
  }
  return "Workspace";
}

export function TopBar() {
  const pathname = usePathname();
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const { setTheme, resolvedTheme } = useTheme();
  const openNewIssueModal = useUIStore((s) => s.openNewIssueModal);
  const setExtractTasksModalOpen = useUIStore(
    (s) => s.setExtractTasksModalOpen,
  );

  const listActive =
    pathname.endsWith("/list") && pathname.startsWith("/issues");
  const boardActive =
    pathname.endsWith("/board") && pathname.startsWith("/issues");
  const showIssuesViewToggle =
    pathname.startsWith("/issues") &&
    (pathname === "/issues/list" ||
      pathname === "/issues/board" ||
      isIssueDetailPath(pathname));

  const { data: sprintRes } = useQuery({
    queryKey: ["activeSprint", organizationId],
    enabled: Boolean(organizationId) && pathname.startsWith("/issues"),
    queryFn: async ({ queryKey }) =>
      apiJson<ActiveSprintDto>("/api/sprints/active", { orgId: queryKey[1] }),
  });

  const sprintName =
    sprintRes?.success === true && sprintRes.data ? sprintRes.data.name : null;
  const subtitle = contextSubtitle(pathname, sprintName);
  const recordingPhase = useRecordingSessionStore((s) => s.phase);
  const recordingDurationMs = useRecordingSessionStore((s) => s.durationMs);
  const recordingPaused = useRecordingSessionStore((s) => s.isPaused);
  const pauseOrResumeRecording = useRecordingSessionStore(
    (s) => s.pauseOrResume,
  );

  const recordingChipVisible = recordingPhase !== "idle";
  const recordingDurationLabel = (() => {
    const m = Math.floor(recordingDurationMs / 60000)
      .toString()
      .padStart(2, "0");
    const s = Math.floor((recordingDurationMs % 60000) / 1000)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  })();

  const toggleTheme = () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  const onCreateIssue = () => {
    const m = pathname.match(/^\/projects\/([^/]+)/);
    const slug = m ? safeDecodeURIComponent(m[1]) : null;
    openNewIssueModal(slug);
  };

  return (
    <header className="sticky top-0 z-10 flex h-14 w-full items-center justify-between border-b border-linear-border bg-(--bg)/80 px-6 backdrop-blur-md transition-colors duration-200">
      <div className="flex items-center gap-4 min-w-0">
        {showIssuesViewToggle ? (
          <>
            <div className="flex bg-white/5 p-1 rounded-lg border border-(--border) shrink-0">
              <Link
                href="/issues/list"
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                  listActive
                    ? "bg-(--hover) text-(--text)"
                    : "text-linear-text-muted hover:text-(--text)"
                }`}
              >
                List
              </Link>
              <Link
                href="/issues/board"
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                  boardActive
                    ? "bg-(--hover) text-(--text)"
                    : "text-linear-text-muted hover:text-(--text)"
                }`}
              >
                Board
              </Link>
            </div>
            <div className="h-4 w-px bg-(--border) shrink-0" />
          </>
        ) : null}
        <span
          className="text-xs font-medium text-linear-text-muted uppercase tracking-wider truncate"
          title={subtitle}
        >
          {subtitle}
        </span>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {/* <div className="relative hidden sm:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-linear-text-muted" />
          <input
            type="text"
            placeholder="Search issues..."
            className="bg-white/5 border border-(--border) rounded-md pl-10 pr-4 py-1.5 text-xs focus:outline-none focus:border-linear-accent w-64 transition-colors duration-200"
            disabled
            aria-disabled
            title="Search coming soon"
          />
        </div> */}
        <button
          type="button"
          onClick={onCreateIssue}
          className="linear-button-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Issue
        </button>
        {recordingPhase === "idle" ? (
          <button
            type="button"
            onClick={() => setExtractTasksModalOpen(true, "paste")}
            className="h-8 px-3 rounded-md bg-white/5 border border-(--border) flex items-center gap-2 text-xs hover:bg-(--hover) transition-all duration-200"
          >
            <Sparkles className="h-[14px] w-[14px]" />
            Extract Tasks
          </button>
        ) : null}
        {recordingChipVisible ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExtractTasksModalOpen(true, "record")}
              className="h-8 pl-2 pr-2 rounded-md bg-red-500/15 border border-red-500/40 flex items-center gap-2 text-xs text-red-200 hover:bg-red-500/25 transition-all duration-200 max-w-[200px]"
              title="Recording session — click to open"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="truncate">
                {recordingPhase === "uploading"
                  ? "Processing…"
                  : recordingPhase === "stopped"
                    ? "Recording ready"
                    : recordingPhase === "starting"
                      ? "Starting…"
                      : "Recording"}
              </span>
              <span className="tabular-nums text-linear-text-muted shrink-0">
                {recordingDurationLabel}
              </span>
            </button>
            {recordingPhase === "capturing" ? (
              <button
                type="button"
                onClick={() => pauseOrResumeRecording()}
                className="h-8 w-8 rounded-md bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-200 hover:bg-red-500/25 transition-all duration-200"
                title={recordingPaused ? "Resume" : "Pause"}
                aria-label={
                  recordingPaused ? "Resume recording" : "Pause recording"
                }
              >
                {recordingPaused ? (
                  <Play className="w-3.5 h-3.5" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
              </button>
            ) : null}
          </div>
        ) : null}
        <ThemePrimaryDevPicker />
        <button
          type="button"
          onClick={toggleTheme}
          className="h-8 w-8 rounded-full bg-white/5 border border-(--border) flex items-center justify-center cursor-pointer hover:bg-(--hover) transition-all duration-200"
          aria-label="Toggle theme"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="w-4 h-4 text-linear-text-muted" />
          ) : (
            <Moon className="w-4 h-4 text-linear-text-muted" />
          )}
        </button>
        <button
          type="button"
          disabled
          aria-label="Notifications (coming soon)"
          title="Notifications coming soon"
          className="h-8 w-8 rounded-full bg-white/5 border border-(--border) flex items-center justify-center cursor-not-allowed opacity-70"
        >
          <Bell className="w-4 h-4 text-linear-text-muted" />
        </button>
        <Link
          href="/settings"
          className="h-8 w-8 rounded-full flex items-center justify-center cursor-pointer overflow-hidden border border-(--border) hover:scale-105 transition-transform duration-200 [background-color:var(--primary)] [background-image:var(--primary-gradient,none)]"
        >
          <Image
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
            alt="User"
            width={32}
            height={32}
            className="w-full h-full object-cover"
            unoptimized
          />
        </Link>
      </div>
    </header>
  );
}
