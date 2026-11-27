"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { switchActiveOrganization } from "@/lib/invalidate-org-queries";
import { writeLastOrganizationId } from "@/lib/last-organization";
import {
  propertyRowClass,
  propertySelectContentClass,
  propertySelectItemClass,
  SELECT_NO_OPTIONS_MESSAGE,
} from "@/components/issues/detail/issueDetailPropertySelectStyles";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrganizationStore } from "@/stores/useOrganizationStore";

function roleShort(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

export function WorkspaceSwitcher() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const organizations = useAuthStore((s) => s.organizations);
  const organizationId = useOrganizationStore((s) => s.organizationId);

  if (!user) return null;

  const hasWorkspaces = organizations.length > 0;

  if (!hasWorkspaces) {
    return (
      <div className="px-3 pb-3">
        <label className="flex items-center gap-2 px-1 mb-1.5 text-[10px] font-bold text-linear-text-muted uppercase tracking-widest">
          <Building2 className="w-3 h-3" />
          Workspace
        </label>
        <div
          role="status"
          aria-live="polite"
          className={cn(
            propertyRowClass,
            "h-9 cursor-default opacity-80 text-linear-text-muted dark:text-[rgba(255,255,255,0.45)]",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left text-xs font-medium">
            {SELECT_NO_OPTIONS_MESSAGE}
          </span>
        </div>
      </div>
    );
  }

  const current =
    organizations.find((o) => o.id === organizationId) ?? organizations[0];
  const resolvedId =
    organizationId && organizations.some((o) => o.id === organizationId)
      ? organizationId
      : current.id;
  const selectedOrg =
    organizations.find((o) => o.id === resolvedId) ?? organizations[0];
  const triggerLabel = `${selectedOrg.name} (${roleShort(selectedOrg.role)})`;

  return (
    <div className="px-3 pb-3">
      <label className="flex items-center gap-2 px-1 mb-1.5 text-[10px] font-bold text-linear-text-muted uppercase tracking-widest">
        <Building2 className="w-3 h-3" />
        Workspace
      </label>
      <Select
        modal={false}
        value={resolvedId}
        onValueChange={(id) => {
          if (!id || id === organizationId) return;
          writeLastOrganizationId(user.id, id);
          void switchActiveOrganization(queryClient, id);
        }}
      >
        <SelectTrigger
          aria-label="Switch workspace"
          className={cn(
            propertyRowClass,
            "h-9 w-full min-w-0 py-0 pr-2 pl-2.5 text-xs font-medium shadow-none focus-visible:ring-0 data-placeholder:text-linear-text-muted dark:data-placeholder:text-[rgba(255,255,255,0.35)]",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {triggerLabel}
          </span>
          <SelectValue className="sr-only" />
        </SelectTrigger>
        <SelectContent
          align="start"
          className={cn(propertySelectContentClass, "w-(--anchor-width)")}
        >
          {organizations.map((o) => (
            <SelectItem
              key={o.id}
              value={o.id}
              className={propertySelectItemClass}
            >
              {o.name} ({roleShort(o.role)})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
