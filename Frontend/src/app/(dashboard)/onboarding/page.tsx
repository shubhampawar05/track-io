"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Layers } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { useUIStore } from "@/stores/useUIStore";
import { AppLoadingSkeleton } from "@/components/layout/AppLoadingSkeleton";

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const organizations = useAuthStore((s) => s.organizations);
  const hydrated = useAuthStore((s) => s.hydrated);
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const hydrate = useAuthStore((s) => s.hydrate);
  const showToast = useUIStore((s) => s.showToast);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const current = useMemo(
    () => organizations.find((o) => o.id === organizationId) ?? organizations[0],
    [organizations, organizationId],
  );

  useEffect(() => {
    if (current?.name) setName(current.name);
  }, [current?.name]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.replace("/");
  }, [router, user, hydrated]);

  const save = async () => {
    const n = name.trim();
    if (!n || !organizationId || n === current?.name) {
      router.replace("/issues/board");
      return;
    }
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
      showToast("Workspace ready");
      router.replace("/issues/board");
    } finally {
      setBusy(false);
    }
  };

  if (!hydrated || !user || !organizationId || !current) {
    return <AppLoadingSkeleton />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 bg-linear-accent rounded-xl flex items-center justify-center shadow-lg shadow-linear-accent/20">
            <Layers className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Name your workspace</h1>
            <p className="text-sm text-linear-text-muted mt-2">
              You can change this anytime in Settings. Skip to keep &quot;{current.name}&quot;.
            </p>
          </div>
        </div>
        <div className="linear-card p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-linear-text-muted uppercase tracking-widest" htmlFor="onb-name">
              Workspace name
            </label>
            <input
              id="onb-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-(--border) rounded-md px-4 py-2 text-sm focus:outline-none focus:border-linear-accent transition-all duration-200"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => router.replace("/issues/board")}
              className="px-4 py-2 text-sm font-medium hover:bg-white/5 rounded-md border border-(--border) transition-colors disabled:opacity-50"
            >
              Skip for now
            </button>
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => void save()}
              className="linear-button-primary disabled:opacity-50"
            >
              {busy ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
