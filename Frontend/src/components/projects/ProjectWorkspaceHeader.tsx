"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Settings } from "lucide-react";
import { useMemo, useState } from "react";
import { projectDetailQueryKey, useProjectDetail } from "@/hooks/useProjectDetail";
import { apiJson } from "@/lib/api-client";
import type { ProjectCard, ProjectDetail } from "@/types/issue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { useUIStore } from "@/stores/useUIStore";

export function ProjectWorkspaceHeader({ project }: { project: ProjectCard }) {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "board" ? "board" : "list";
  const showToast = useUIStore((s) => s.showToast);
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const organizations = useAuthStore((s) => s.organizations);
  const canManageGithub = useMemo(() => {
    if (!organizationId || !organizations.length) return false;
    const role = organizations.find((o) => o.id === organizationId)?.role;
    return role === "owner" || role === "admin";
  }, [organizationId, organizations]);
  const base = `/projects/${encodeURIComponent(project.slug)}`;
  const [githubPanel, setGithubPanel] = useState(false);
  /** `null` = untouched; input shows the loaded project's repo until the user edits it. */
  const [repoDraft, setRepoDraft] = useState<string | null>(null);

  const projectQuery = useProjectDetail(project.slug, { enabled: githubPanel });
  const repoInput = repoDraft ?? projectQuery.data?.githubRepoFullName ?? "";
  const projectNotReady = projectQuery.isPending || projectQuery.isError;

  const saveRepo = useMutation({
    mutationFn: async () => {
      const r = await apiJson<ProjectDetail>(`/api/projects/${encodeURIComponent(project.slug)}`, {
        method: "PATCH",
        body: { githubRepoFullName: repoInput.trim() || null },
      });
      if (!r.success) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (data) => {
      showToast("GitHub repo saved", "success");
      queryClient.setQueryData(projectDetailQueryKey(organizationId, project.slug), data);
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      setGithubPanel(false);
      setRepoDraft(null);
    },
    onError: (e: Error) => showToast(e.message || "Save failed", "error"),
  });

  const linked = (project.githubRepoFullName ?? "").trim();

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
      <div className="h-14 flex items-center justify-between px-6">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href="/projects"
            className="flex items-center gap-2 text-xs font-medium text-linear-text-muted hover:text-[var(--text)] transition-all duration-200 group shrink-0"
          >
            <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-0.5 transition-transform duration-200" />
            Projects
          </Link>
          <div className="h-4 w-px bg-[var(--border)] shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-5 h-5 rounded-md ${project.color} flex items-center justify-center text-[10px] text-white font-bold shrink-0`}
            >
              {project.name.charAt(0)}
            </div>
            <span className="text-sm font-semibold truncate">{project.name}</span>
            {linked ? (
              <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-linear-text-muted font-mono truncate max-w-[10rem]">
                {linked}
              </span>
            ) : null}
          </div>
          <div className="h-4 w-px bg-[var(--border)] ml-2 shrink-0" />
          <div className="flex bg-white/5 p-1 rounded-lg border border-[var(--border)] shrink-0">
            <Link
              href={`${base}?view=list`}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
                view === "list"
                  ? "bg-[var(--hover)] text-[var(--text)]"
                  : "text-linear-text-muted hover:text-[var(--text)]"
              }`}
            >
              List
            </Link>
            <Link
              href={`${base}?view=board`}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
                view === "board"
                  ? "bg-[var(--hover)] text-[var(--text)]"
                  : "text-linear-text-muted hover:text-[var(--text)]"
              }`}
            >
              Board
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {canManageGithub ? (
            <button
              type="button"
              onClick={() => {
                setGithubPanel((v) => !v);
                setRepoDraft(null);
              }}
              className={`p-2 rounded-md transition-all duration-200 ${
                githubPanel ? "bg-[var(--hover)] text-[var(--text)]" : "hover:bg-[var(--hover)] text-linear-text-muted"
              }`}
              aria-expanded={githubPanel}
              aria-label="GitHub repository settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>
      {githubPanel && canManageGithub ? (
        <div className="px-6 pb-4 pt-0 border-t border-[var(--border)]/60 space-y-3">
          <p className="text-[11px] text-linear-text-muted pt-3">
            Set the GitHub repository as <span className="font-mono">owner/repo</span> so incoming webhooks (from{" "}
            <Link href="/integrations" className="text-indigo-400 hover:underline">
              Integrations
            </Link>
            ) only link PRs for this project.
          </p>
          <div className="flex flex-wrap items-center gap-2 max-w-xl">
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoDraft(e.target.value)}
              placeholder="e.g. acme/track-io"
              className="flex-1 min-w-[12rem] bg-white/5 border border-[var(--border)] rounded-md text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/20"
              disabled={projectNotReady || saveRepo.isPending}
            />
            <button
              type="button"
              disabled={saveRepo.isPending || projectNotReady}
              onClick={() => saveRepo.mutate()}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-[var(--border)] rounded-md text-xs font-medium disabled:opacity-50"
            >
              {saveRepo.isPending ? "Saving…" : "Save"}
            </button>
          </div>
          {projectQuery.isError ? (
            <p className="text-[11px] text-red-400">
              Could not load project settings. Close and reopen to try again.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
