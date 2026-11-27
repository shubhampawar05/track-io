"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { DashboardOverlays } from "@/components/layout/DashboardOverlays";
import { useAuthStore } from "@/stores/useAuthStore";
import { AppLoadingSkeleton } from "@/components/layout/AppLoadingSkeleton";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (hydrated && !user) router.replace("/");
  }, [hydrated, user, router]);

  if (!hydrated) {
    return <AppLoadingSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-(--bg) flex items-center justify-center text-linear-text-muted text-sm">
        Redirecting…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-(--bg) text-(--text)">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen w-full">
        <TopBar />
        {children}
      </div>
      <DashboardOverlays />
    </div>
  );
}
