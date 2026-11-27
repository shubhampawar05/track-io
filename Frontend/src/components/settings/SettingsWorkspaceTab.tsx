"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { apiJson } from "@/lib/api-client";
import { useUIStore } from "@/stores/useUIStore";

export function SettingsWorkspaceTab() {
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const organizations = useAuthStore((s) => s.organizations);
  const hydrate = useAuthStore((s) => s.hydrate);
  const showToast = useUIStore((s) => s.showToast);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const current = useMemo(
    () => organizations.find((o) => o.id === organizationId) ?? organizations[0],
    [organizations, organizationId],
  );

  const canRename = current?.role === "owner" || current?.role === "admin";

  useEffect(() => {
    if (current?.name) setName(current.name);
  }, [current?.name]);

  const save = async () => {
    const n = name.trim();
    if (!n || !organizationId || n === current?.name) return;
    setBusy(true);
    try {
      const r = await apiJson<{ id: string; name: string }>("/api/organizations", {
        method: "PATCH",
        body: { name: n },
      });
      if (!r.success) {
        showToast(r.error, "error");
        return;
      }
      await hydrate({ force: true });
      showToast("Workspace name updated");
    } finally {
      setBusy(false);
    }
  };

  if (!organizationId || !current) {
    return (
      <p className="text-sm text-linear-text-muted">
        Select an organization in the app header (when available) to manage workspace settings.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-semibold mb-2">Workspace</h3>
        <p className="text-sm text-linear-text-muted">Name applies to everyone in this organization.</p>
      </div>
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-linear-text-muted uppercase tracking-widest" htmlFor="workspace-name">
            Workspace name
          </label>
          <input
            id="workspace-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canRename}
            className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-linear-accent transition-colors duration-200 disabled:opacity-50"
          />
          {!canRename ? (
            <p className="text-[10px] text-linear-text-muted">Only owners and admins can rename the workspace.</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <span className="text-xs font-bold text-linear-text-muted uppercase tracking-widest">Workspace ID</span>
          <div className="w-full bg-white/[0.03] border border-[var(--border)] rounded-lg px-4 py-2 text-sm font-mono text-linear-text-muted break-all">
            {organizationId}
          </div>
          <p className="text-[10px] text-linear-text-muted">Used for API requests; not a public URL.</p>
        </div>
        {canRename ? (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              disabled={busy || !name.trim() || name.trim() === current.name}
              onClick={() => void save()}
              className="linear-button-primary disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save workspace name"}
            </button>
          </div>
        ) : null}
        <div className="pt-8 border-t border-[var(--border)]">
          <h4 className="text-red-500 font-semibold mb-2">Danger zone</h4>
          <p className="text-sm text-linear-text-muted mb-4">
            Deleting a workspace is not available yet.
          </p>
          <button
            type="button"
            disabled
            className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-md text-sm font-medium opacity-50 cursor-not-allowed"
          >
            Delete workspace
          </button>
        </div>
      </div>
    </div>
  );
}
