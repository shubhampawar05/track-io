"use client";

import { SettingsView } from "@/components/settings/SettingsView";
import { useUIStore } from "@/stores/useUIStore";

export default function SettingsPage() {
  const setInviteOpen = useUIStore((s) => s.setInviteModalOpen);
  return <SettingsView onInvite={() => setInviteOpen(true)} />;
}
