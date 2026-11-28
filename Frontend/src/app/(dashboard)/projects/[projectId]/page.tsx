import { Suspense } from "react";
import { ProjectWorkspace } from "@/components/projects/ProjectWorkspace";
import { DashboardMainPanelSkeleton } from "@/components/layout/DashboardMainPanelSkeleton";
import { safeDecodeURIComponent } from "@/lib/utils";

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectDetailPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <Suspense fallback={<DashboardMainPanelSkeleton />}>
      <ProjectWorkspace projectId={safeDecodeURIComponent(projectId)} />
    </Suspense>
  );
}
