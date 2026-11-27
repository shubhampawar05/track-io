"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { useUIStore } from "@/stores/useUIStore";

function roleLabel(role: string) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

export function SettingsProfileTab() {
  const user = useAuthStore((s) => s.user);
  const organizations = useAuthStore((s) => s.organizations);
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const patchProfile = useAuthStore((s) => s.patchProfile);
  const showToast = useUIStore((s) => s.showToast);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  if (!user) {
    return <p className="text-sm text-linear-text-muted">Sign in to manage your profile.</p>;
  }

  const save = async () => {
    const n = name.trim();
    if (!n || n === user.name) return;
    setBusy(true);
    try {
      const err = await patchProfile(n);
      if (err) {
        showToast(err, "error");
        return;
      }
      showToast("Profile updated");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-semibold mb-2">Profile</h3>
        <p className="text-sm text-linear-text-muted">Your name is saved to your account.</p>
      </div>
      <div className="space-y-6">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="w-20 h-20 rounded-full bg-linear-accent flex items-center justify-center text-2xl font-bold border-4 border-[var(--border)] text-primary-foreground">
            {user.initials}
          </div>
          <div className="space-y-2">
            <button
              type="button"
              disabled
              className="px-4 py-1.5 bg-white/5 border border-[var(--border)] rounded-md text-xs font-medium text-linear-text-muted cursor-not-allowed opacity-60"
            >
              Change Avatar
            </button>
            <p className="text-[10px] text-linear-text-muted">Avatar upload coming later.</p>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-linear-text-muted uppercase tracking-widest" htmlFor="settings-full-name">
            Full name
          </label>
          <input
            id="settings-full-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-linear-accent transition-colors duration-200"
          />
        </div>
        {organizations.length > 0 ? (
          <div className="space-y-2 pt-2 border-t border-[var(--border)]">
            <label className="flex items-center gap-2 text-xs font-bold text-linear-text-muted uppercase tracking-widest">
              <Building2 className="w-3.5 h-3.5" />
              Your workspaces
            </label>
            <p className="text-[10px] text-linear-text-muted mb-2">
              Switch the active workspace from the sidebar. Invited workspaces appear here after you accept the invite.
            </p>
            <ul className="space-y-2">
              {organizations.map((o) => (
                <li
                  key={o.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                    o.id === organizationId ? "border-linear-accent bg-linear-accent/10" : "border-[var(--border)] bg-white/[0.02]"
                  }`}
                >
                  <span className="font-medium truncate">{o.name}</span>
                  <span className="text-xs text-linear-text-muted shrink-0">{roleLabel(o.role)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="space-y-2">
          <label className="text-xs font-bold text-linear-text-muted uppercase tracking-widest" htmlFor="settings-email">
            Email
          </label>
          <input
            id="settings-email"
            type="email"
            value={user.email}
            readOnly
            className="w-full bg-white/[0.03] border border-[var(--border)] rounded-lg px-4 py-2 text-sm text-linear-text-muted cursor-not-allowed"
          />
          <p className="text-[10px] text-linear-text-muted">Email cannot be changed here.</p>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-linear-text-muted uppercase tracking-widest" htmlFor="settings-bio">
            Bio
          </label>
          <textarea
            id="settings-bio"
            disabled
            placeholder="Bio will be available in a future update."
            className="w-full bg-white/[0.03] border border-[var(--border)] rounded-lg px-4 py-2 text-sm text-linear-text-muted min-h-[100px] resize-none cursor-not-allowed"
          />
        </div>
        <div className="pt-4 flex justify-end">
          <button
            type="button"
            disabled={busy || !name.trim() || name.trim() === user.name}
            onClick={() => void save()}
            className="linear-button-primary disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
