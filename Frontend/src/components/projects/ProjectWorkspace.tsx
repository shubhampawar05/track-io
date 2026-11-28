"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { BoardView } from "@/components/issues/BoardView";
import { ListView } from "@/components/issues/ListView";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";
import { useIssuesList } from "@/hooks/useIssuesList";
import { useProjectsList } from "@/hooks/useProjectsList";
import { ProjectWorkspaceSkeleton } from "@/components/projects/ProjectWorkspaceSkeleton";
import { QueryErrorState } from "@/components/ui/QueryErrorState";

/** `projectId` is the already-decoded route segment (decoded once by the page). */
export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "board" ? "board" : "list";
  const {
    projects,
    loading: loadingProjects,
    isError: projectsError,
    error: projectsErrorValue,
    refetch: refetchProjects,
  } = useProjectsList();
  const project = projects.find((p) => p.slug === projectId || p.name === projectId);
  const {
    issues,
    loading: loadingIssues,
    isError: issuesError,
    error: issuesErrorValue,
    refetch: refetchIssues,
    reorderBoard,
    appliedPipelineFilters,
  } = useIssuesList(
    project ? project.slug : "",
    { applyPipelineFilters: true },
  );

  if (loadingProjects) {
    return <ProjectWorkspaceSkeleton />;
  }

  if (!project && projectsError) {
    return (
      <div className="p-8">
        <QueryErrorState
          message="Could not load this project."
          error={projectsErrorValue}
          onRetry={() => void refetchProjects()}
        />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 space-y-4">
        <p className="text-linear-text-muted">Project not found.</p>
        <Link href="/projects" className="text-linear-accent text-sm hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full overflow-hidden">
      <ProjectWorkspaceHeader project={project} />
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        <AnimatePresence mode="wait">
          {view === "board" ? (
            <motion.div
              key="project-board"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <BoardView
                issues={issues}
                loading={loadingIssues}
                error={issuesError ? issuesErrorValue : null}
                onRetry={() => void refetchIssues()}
                boardScope={project.slug}
                issueNavFrom="project"
                issueNavProjectView={view}
                appliedPipelineFilters={appliedPipelineFilters}
                onBoardReorder={(update) => reorderBoard(update)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="project-list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ListView
                issues={issues}
                loading={loadingIssues}
                error={issuesError ? issuesErrorValue : null}
                onRetry={() => void refetchIssues()}
                projectSlug={project.slug}
                issueNavFrom="project"
                issueNavProjectView={view}
                appliedPipelineFilters={appliedPipelineFilters}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
