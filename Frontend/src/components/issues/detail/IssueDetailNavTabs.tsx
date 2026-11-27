"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TabId = "overview" | "activity" | "subtasks" | "files";

const sectionIds: Record<TabId, string> = {
  overview: "issue-section-description",
  subtasks: "issue-section-subtasks",
  files: "issue-section-files",
  activity: "issue-section-activity",
};

/** Document order for tie-break when two sections share the same intersection ratio. */
const DOM_ORDER: TabId[] = ["overview", "subtasks", "files", "activity"];

const INTERSECTION_THRESHOLDS = Array.from({ length: 51 }, (_, i) => i / 50);

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function pickTabByLargestRatio(ratios: Map<TabId, number>): TabId {
  let maxR = 0;
  for (const tab of DOM_ORDER) {
    maxR = Math.max(maxR, ratios.get(tab) ?? 0);
  }
  if (maxR < 0.001) return "overview";
  const eps = 1e-4;
  for (const tab of DOM_ORDER) {
    const r = ratios.get(tab) ?? 0;
    if (Math.abs(r - maxR) < eps) return tab;
  }
  return "overview";
}

export function IssueDetailNavTabs({
  scrollRoot,
  commentCount,
  subtaskCount,
  filesCount,
}: {
  scrollRoot: HTMLElement | null;
  commentCount: number;
  subtaskCount: number;
  filesCount: number;
}) {
  const [active, setActive] = useState<TabId>("overview");
  const userPickingRef = useRef(false);
  const ratiosRef = useRef(new Map<TabId, number>());

  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: "Overview" },
        { id: "subtasks" as const, label: "Subtasks", count: subtaskCount },
        { id: "files" as const, label: "Files", count: filesCount },
        { id: "activity" as const, label: "Activity", count: commentCount },
      ] as const,
    [commentCount, filesCount, subtaskCount],
  );

  useEffect(() => {
    if (!scrollRoot) return;

    ratiosRef.current = new Map();
    const idToTab = new Map<string, TabId>(
      (Object.entries(sectionIds) as [TabId, string][]).map(([tab, domId]) => [
        domId,
        tab,
      ]),
    );

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const domId = (entry.target as HTMLElement).id;
          const tab = idToTab.get(domId);
          if (tab) ratiosRef.current.set(tab, entry.intersectionRatio);
        }
        if (!userPickingRef.current) {
          setActive(pickTabByLargestRatio(ratiosRef.current));
        }
      },
      {
        root: scrollRoot,
        threshold: INTERSECTION_THRESHOLDS,
        rootMargin: "0px",
      },
    );

    for (const domId of Object.values(sectionIds)) {
      const el = document.getElementById(domId);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [scrollRoot]);

  const onPick = useCallback((tab: TabId) => {
    userPickingRef.current = true;
    setActive(tab);
    scrollToId(sectionIds[tab]);
    window.setTimeout(() => {
      userPickingRef.current = false;
      setActive(pickTabByLargestRatio(ratiosRef.current));
    }, 700);
  }, []);

  return (
    <div className="sticky top-0 -mx-6 bg-[var(--bg)]/90 border-none px-6 backdrop-blur-md sm:-mx-8 sm:px-8">
      <nav className="relative" aria-label="Issue sections">
        <div className="relative z-10 flex gap-0.5 overflow-visible">
          {tabs.map((t) => {
            const selected = active === t.id;
            const count = "count" in t ? t.count : undefined;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onPick(t.id)}
                className={`relative flex items-center gap-2 overflow-visible px-3 pb-2.5 pt-1.5 text-sm font-medium transition-colors ${
                  selected
                    ? "text-[var(--text)]"
                    : "text-linear-text-muted hover:text-[var(--text)]"
                }`}
              >
                <span>{t.label}</span>
                {count !== undefined ? (
                  <span
                    className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums ${
                      selected
                        ? "bg-[color-mix(in_srgb,var(--primary)_28%,transparent)] text-[var(--text)]"
                        : "bg-[color-mix(in_srgb,var(--primary)_16%,transparent)] text-linear-text-muted"
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
                {selected ? (
                  <span
                    className="issue-detail-tab-indicator pointer-events-none absolute bottom-0 left-3 right-3 z-10 h-[3px] rounded-sm"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
