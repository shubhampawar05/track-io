"use client";

import Link from "next/link";
import { FolderKanban, Plus, Users } from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import { useProjectsList } from "@/hooks/useProjectsList";
import { ProjectsGridSkeleton } from "@/components/projects/ProjectsGridSkeleton";
import { QueryErrorState } from "@/components/ui/QueryErrorState";

export function ProjectsView() {
  const setProjectModalOpen = useUIStore((s) => s.setProjectModalOpen);
  const { projects, loading, isError, isSuccess, error, refetch } = useProjectsList();

  if (loading) {
    return <ProjectsGridSkeleton />;
  }

  return (
    <div className="p-8 space-y-8 w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-semibold mb-2">Projects</h2>
          <p className="text-linear-text-muted">
            Manage your team&apos;s high-level initiatives and roadmaps.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setProjectModalOpen(true)}
          className="linear-button-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {isError ? (
        <QueryErrorState
          message="Could not load projects."
          error={error}
          onRetry={() => void refetch()}
        />
      ) : isSuccess && projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-(--border) px-6 py-16 flex flex-col items-center text-center gap-4">
          <FolderKanban className="w-8 h-8 text-linear-text-muted" aria-hidden="true" />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">No projects yet</h3>
            <p className="text-sm text-linear-text-muted max-w-sm">
              Projects group issues, boards and members. Create one to get started.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setProjectModalOpen(true)}
            className="linear-button-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create your first project
          </button>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Link
            key={project.slug}
            href={`/projects/${encodeURIComponent(project.slug)}`}
            className="linear-card p-6 space-y-6 hover:border-linear-accent/50 transition-all duration-200 cursor-pointer group block"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg ${project.color} flex items-center justify-center text-white font-bold`}
              >
                {project.name.charAt(0)}
              </div>
              <div>
                <h4 className="font-semibold group-hover:text-linear-accent transition-colors duration-200">
                  {project.name}
                </h4>
                <span className="text-[10px] text-linear-text-muted uppercase tracking-widest">
                  {project.status}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-linear-text-muted">Progress</span>
                <span className="font-medium">{project.progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${project.color} transition-all duration-1000`}
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 text-xs text-linear-text-muted">
              <Users className="w-3 h-3" />
              <span>
                {project.members} member{project.members === 1 ? "" : "s"}
              </span>
            </div>
          </Link>
        ))}
      </div>
      )}
    </div>
  );
}
