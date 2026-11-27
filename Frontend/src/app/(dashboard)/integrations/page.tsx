import { Suspense } from "react";
import { IntegrationsView } from "@/components/integrations/IntegrationsView";
import { DashboardMainPanelSkeleton } from "@/components/layout/DashboardMainPanelSkeleton";

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<DashboardMainPanelSkeleton />}>
      <IntegrationsView />
    </Suspense>
  );
}
