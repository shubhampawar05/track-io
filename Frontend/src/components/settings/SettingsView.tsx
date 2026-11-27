"use client";

import { useState } from "react";
import { Bell, Key, Layers, User, Users, Zap } from "lucide-react";
import { SettingsMembersTab } from "@/components/settings/SettingsMembersTab";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsPreferencesTab } from "@/components/settings/SettingsPreferencesTab";
import { SettingsProfileTab } from "@/components/settings/SettingsProfileTab";
import { SettingsWorkspaceTab } from "@/components/settings/SettingsWorkspaceTab";

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "preferences", label: "Preferences", icon: Zap },
  { id: "workspace", label: "Workspace", icon: Layers },
  { id: "members", label: "Members", icon: Users },
  { id: "security", label: "Security", icon: Key },
  { id: "notifications", label: "Notifications", icon: Bell },
];

export function SettingsView({ onInvite }: { onInvite: () => void }) {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg)]">
      <SettingsNav tabs={tabs} activeTab={activeTab} onTab={setActiveTab} />
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8 sm:p-12 min-w-0">
        <div className="w-full space-y-12">
          {activeTab === "profile" && <SettingsProfileTab />}
          {activeTab === "workspace" && <SettingsWorkspaceTab />}
          {activeTab === "members" && <SettingsMembersTab onInvite={onInvite} />}
          {activeTab === "preferences" && <SettingsPreferencesTab />}
          {(activeTab === "security" || activeTab === "notifications") && (
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold capitalize">{activeTab}</h3>
              <p className="text-sm text-linear-text-muted">Coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
