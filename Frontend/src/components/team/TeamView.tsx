"use client";

import { ArrowUpRight, Zap } from "lucide-react";
import { useIssuesList } from "@/hooks/useIssuesList";
import { useOrganizationInvitesQuery, useOrganizationMembersQuery } from "@/hooks/useOrganizationRosterQueries";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { Skeleton } from "@/components/ui/Skeleton";

export function TeamView({ name }: { name: string }) {
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const organizations = useAuthStore((s) => s.organizations);
  const currentOrg = organizations.find((o) => o.id === organizationId);
  const displayName = currentOrg?.name ?? name;
  const design = name.toLowerCase().includes("design");

  const { data: membersRes, isPending: membersLoading } = useOrganizationMembersQuery();
  const { data: invitesRes } = useOrganizationInvitesQuery();
  const { issues, loading: issuesLoading } = useIssuesList(null);

  const role = currentOrg?.role;
  const canSeeInvites = role === "owner" || role === "admin";

  const members = membersRes?.success ? membersRes.data : [];
  const invites = invitesRes?.success ? invitesRes.data : [];
  const pendingInvites = invites.filter((i) => i.status === "pending").length;

  const memberCount = members.length;
  const issueCount = issues.length;
  const previewMembers = members.slice(0, 8);

  return (
    <div className="p-8 space-y-8 w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={`w-12 h-12 rounded-xl ${design ? "bg-purple-500" : "bg-blue-500"} flex items-center justify-center text-white font-bold text-xl shrink-0`}
          >
            {displayName.charAt(0)}
          </div>
          <div>
            <h2 className="text-3xl font-semibold truncate">{displayName}</h2>
            <p className="text-linear-text-muted text-sm">Team workspace — live counts from the server.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="linear-card p-6 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-linear-text-muted">Issues in workspace</h4>
          <div className="text-3xl font-bold tabular-nums">
            {issuesLoading ? <Skeleton className="inline-block h-9 w-16 align-middle" /> : issueCount}
          </div>
          <div className="text-[10px] text-linear-text-muted flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            All projects (current workspace)
          </div>
        </div>
        <div className="linear-card p-6 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-linear-text-muted">Pending invites</h4>
          <div className="text-3xl font-bold">{!canSeeInvites ? "—" : pendingInvites}</div>
          <div className="text-[10px] text-blue-500 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {canSeeInvites ? "Owner/admin visibility" : "Members do not see invite list"}
          </div>
        </div>
        <div className="linear-card p-6 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-linear-text-muted">Members</h4>
          <div className="text-3xl font-bold tabular-nums">
            {membersLoading ? <Skeleton className="inline-block h-9 w-16 align-middle" /> : memberCount}
          </div>
          <div className="flex -space-x-2 mt-2 flex-wrap">
            {membersLoading ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="w-8 h-8 rounded-full border-2 border-(--card) shrink-0" />
                ))}
              </>
            ) : previewMembers.length === 0 ? (
              <span className="text-xs text-linear-text-muted">No members</span>
            ) : (
              previewMembers.map((m) => (
                <div
                  key={m.userId}
                  title={`${m.name} (${m.email})`}
                  className="w-8 h-8 rounded-full border-2 border-(--card) bg-white/10 flex items-center justify-center text-[10px] font-bold"
                >
                  {m.initials}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
