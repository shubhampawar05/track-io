"use client";

import { useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, X } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useOrganizationInvitesQuery, useOrganizationMembersQuery } from "@/hooks/useOrganizationRosterQueries";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { useUIStore } from "@/stores/useUIStore";
import {
  SettingsInvitesListSkeleton,
  SettingsMembersTableSkeleton,
} from "@/components/settings/SettingsTabSkeletons";

function roleLabel(role: string) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

function inviteStatusLabel(status: string) {
  if (status === "pending") return "Pending";
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  if (status === "cancelled") return "Cancelled";
  return status;
}

export function SettingsMembersTab({ onInvite }: { onInvite: () => void }) {
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const organizations = useAuthStore((s) => s.organizations);
  const role = organizations.find((o) => o.id === organizationId)?.role;
  const canInvite = role === "owner" || role === "admin";

  const { data, isPending, isError } = useOrganizationMembersQuery();
  const {
    data: invitesData,
    isPending: invitesPending,
    isError: invitesError,
  } = useOrganizationInvitesQuery();

  const members = data?.success ? data.data : [];
  const invites = invitesData?.success ? invitesData.data : [];

  const cancelInvite = async (inviteId: string) => {
    const r = await apiJson<true>(`/api/organizations/invites/${encodeURIComponent(inviteId)}`, {
      method: "DELETE",
    });
    if (!r.success) {
      showToast(r.error, "error");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["organization", "invites", organizationId] });
    showToast("Invitation cancelled");
  };

  if (!organizationId) {
    return <p className="text-sm text-linear-text-muted">No organization context.</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-2xl font-semibold mb-2">Members</h3>
          <p className="text-sm text-linear-text-muted">People in this workspace (from the server).</p>
        </div>
        {canInvite ? (
          <button type="button" onClick={onInvite} className="linear-button-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Invite member
          </button>
        ) : null}
      </div>

      {canInvite ? (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-(--text)">Invitations</h4>
          {invitesPending ? (
            <SettingsInvitesListSkeleton />
          ) : invitesError || !invitesData?.success ? (
            <p className="text-sm text-red-400">Could not load invitations.</p>
          ) : invites.length === 0 ? (
            <p className="text-sm text-linear-text-muted">No invitations yet.</p>
          ) : (
            <div className="linear-card overflow-hidden">
              {invites.map((inv, idx) => (
                <div
                  key={inv.id}
                  className={`flex items-center justify-between p-4 gap-4 flex-wrap ${
                    idx !== invites.length - 1 ? "border-b border-(--border)" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{inv.email}</p>
                    <p className="text-xs text-linear-text-muted mt-0.5">
                      {inviteStatusLabel(inv.status)} · {roleLabel(inv.role)} · invited by {inv.invitedByName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {inv.status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => void cancelInvite(inv.id)}
                        className="p-1.5 hover:bg-white/5 rounded-md text-linear-text-muted hover:text-red-400 transition-colors"
                        aria-label="Cancel invitation"
                        title="Cancel invitation"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {isPending ? (
        <SettingsMembersTableSkeleton />
      ) : isError || !data?.success ? (
        <p className="text-sm text-red-400">Could not load members.</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-linear-text-muted">No members found.</p>
      ) : (
        <div className="linear-card overflow-hidden">
          {members.map((member, idx) => (
            <div
              key={member.userId}
              className={`flex items-center justify-between p-4 gap-4 ${
                idx !== members.length - 1 ? "border-b border-(--border)" : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {member.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  <p className="text-xs text-linear-text-muted truncate">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-xs text-linear-text-muted">{roleLabel(member.role)}</span>
                <button
                  type="button"
                  className="p-1.5 hover:bg-white/5 rounded-md text-linear-text-muted hover:text-(--text) transition-all duration-200 opacity-40 cursor-not-allowed"
                  aria-label="More"
                  disabled
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
