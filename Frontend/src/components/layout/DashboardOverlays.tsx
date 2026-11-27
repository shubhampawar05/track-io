"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FilterPanel } from "@/components/filters/FilterPanel";
import { InviteMemberModal } from "@/components/modals/InviteMemberModal";
import { NewIssueModal } from "@/components/modals/NewIssueModal";
import { NewProjectModal } from "@/components/modals/NewProjectModal";
import { ExtractTasksModal } from "@/components/modals/ExtractTasksModal";
import { useProjectsList } from "@/hooks/useProjectsList";
import { apiJson } from "@/lib/api-client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { useUIStore } from "@/stores/useUIStore";

export function DashboardOverlays() {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const isModalOpen = useUIStore((s) => s.isModalOpen);
  const closeNewIssueModal = useUIStore((s) => s.closeNewIssueModal);
  const newIssueProjectSlug = useUIStore((s) => s.newIssueProjectSlug);
  const isProjectModalOpen = useUIStore((s) => s.isProjectModalOpen);
  const isExtractTasksModalOpen = useUIStore((s) => s.isExtractTasksModalOpen);
  const extractTasksModalTab = useUIStore((s) => s.extractTasksModalTab);
  const setProjectModalOpen = useUIStore((s) => s.setProjectModalOpen);
  const setExtractTasksModalOpen = useUIStore(
    (s) => s.setExtractTasksModalOpen,
  );
  const isInviteModalOpen = useUIStore((s) => s.isInviteModalOpen);
  const setInviteModalOpen = useUIStore((s) => s.setInviteModalOpen);
  const isFilterOpen = useUIStore((s) => s.isFilterOpen);
  const setFilterOpen = useUIStore((s) => s.setFilterOpen);
  const showToast = useUIStore((s) => s.showToast);
  const { projects } = useProjectsList();

  return (
    <>
      <FilterPanel isOpen={isFilterOpen} onClose={() => setFilterOpen(false)} />
      <NewIssueModal
        isOpen={isModalOpen}
        onClose={closeNewIssueModal}
        projectSlug={newIssueProjectSlug}
        currentUserId={currentUserId}
        onAdd={async ({
          title,
          description,
          status,
          priority,
          label,
          assigneeId,
          projectSlug: payloadProjectSlug,
          dueDate,
        }) => {
          const body: Record<string, unknown> = {
            title,
            description,
            status,
            priority,
            projectSlug: payloadProjectSlug ?? newIssueProjectSlug,
          };
          if (label !== undefined && label !== "") body.label = label;
          if (assigneeId !== undefined) body.assigneeId = assigneeId;
          if (dueDate !== undefined && dueDate !== null && dueDate !== "")
            body.dueDate = dueDate;
          const r = await apiJson<{ id: string }>("/api/issues", {
            method: "POST",
            body,
          });
          if (!r.success) {
            showToast(r.error, "error");
            return;
          }
          void queryClient.invalidateQueries({ queryKey: ["issues"] });
          void queryClient.invalidateQueries({ queryKey: ["projects"] });
          const slugForCache = payloadProjectSlug ?? newIssueProjectSlug;
          if (slugForCache && organizationId) {
            void queryClient.invalidateQueries({
              queryKey: ["project", organizationId, slugForCache],
            });
          }
          showToast("Issue created successfully");
        }}
      />
      <ExtractTasksModal
        isOpen={isExtractTasksModalOpen}
        onClose={() => setExtractTasksModalOpen(false)}
        initialTab={extractTasksModalTab}
        projects={projects}
        onDone={async () => {
          await queryClient.invalidateQueries({ queryKey: ["issues"] });
          await queryClient.invalidateQueries({ queryKey: ["projects"] });
        }}
      />
      <NewProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onAdd={async (name) => {
          const r = await apiJson("/api/projects", {
            method: "POST",
            body: { name },
          });
          if (!r.success) {
            showToast(r.error, "error");
            return;
          }
          void queryClient.invalidateQueries({ queryKey: ["projects"] });
          showToast(`Project "${name}" created successfully`);
        }}
      />
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onInvite={async (email) => {
          const r = await apiJson<{ email: string }>(
            "/api/organizations/invites",
            {
              method: "POST",
              body: { email },
            },
          );
          if (!r.success) return r.error;
          void queryClient.invalidateQueries({
            queryKey: ["organization", "members"],
          });
          void queryClient.invalidateQueries({
            queryKey: ["organization", "invites"],
          });
          showToast(`Invitation sent to ${r.data.email}`);
          return null;
        }}
      />
    </>
  );
}
