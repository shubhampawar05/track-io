"use client";

import type { LucideIcon } from "lucide-react";

export function SettingsNav({
  tabs,
  activeTab,
  onTab,
}: {
  tabs: { id: string; label: string; icon: LucideIcon }[];
  activeTab: string;
  onTab: (id: string) => void;
}) {
  return (
    <div className="w-64 border-r border-[var(--border)] p-6 flex flex-col gap-8 bg-[var(--sidebar)] shrink-0">
      <div>
        <h2 className="text-xl font-bold mb-1">Settings</h2>
        <p className="text-[10px] text-linear-text-muted uppercase tracking-widest font-bold">
          Personal & Workspace
        </p>
      </div>
      <nav className="space-y-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTab(tab.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-white/10 text-[var(--text)] font-medium"
                : "text-linear-text-muted hover:bg-white/5 hover:text-[var(--text)]"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
