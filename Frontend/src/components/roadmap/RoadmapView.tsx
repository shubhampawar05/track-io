"use client";

import { Calendar } from "lucide-react";

/** Roadmaps are deferred post-v1 — do not show fake roadmap items as live data. */
export function RoadmapView() {
  return (
    <div className="p-8 w-full max-w-2xl">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold mb-2">Roadmaps</h2>
        <p className="text-linear-text-muted">
          Plan and track long-term product strategy.
        </p>
      </div>

      <div className="flex flex-col items-start gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)]/40 px-6 py-10">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 border border-[var(--border)]">
          <Calendar className="h-5 w-5 text-linear-text-muted" aria-hidden />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--text)]">Coming soon</h3>
          <p className="mt-1.5 text-sm text-linear-text-muted leading-relaxed max-w-md">
            Roadmaps are not available in v1. Use projects and issues for day-to-day planning
            until this surface ships.
          </p>
        </div>
      </div>
    </div>
  );
}
