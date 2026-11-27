"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Layers,
  Layout,
  LogOut,
  Settings,
  User,
  Users,
  Zap,
  Compass,
} from "lucide-react";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { useUIStore } from "@/stores/useUIStore";

function navClass(active: boolean) {
  return `linear-sidebar-item${active ? " active" : ""}`;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const organizations = useAuthStore((s) => s.organizations);
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const setInviteOpen = useUIStore((s) => s.setInviteModalOpen);
  const showToast = useUIStore((s) => s.showToast);

  const role = organizations.find((o) => o.id === organizationId)?.role;
  const canInvite = role === "owner" || role === "admin";

  const issuesNavActive = pathname.startsWith("/issues");

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-linear-border bg-linear-sidebar">
      <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => router.push("/issues/board")}>
        <div className="linear-accent-fill flex h-8 w-8 items-center justify-center rounded-lg">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold truncate">Trackio</h1>
          <p className="text-[10px] text-linear-text-muted uppercase tracking-wider truncate">
            {organizations.find((o) => o.id === organizationId)?.name ?? "Workspace"}
          </p>
        </div>
      </div>

      <WorkspaceSwitcher />

      <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto custom-scrollbar">
        <div className="space-y-1">
          <Link href="/issues/board" className={navClass(issuesNavActive)}>
            <Layout className="w-4 h-4" />
            Issues
          </Link>
          <Link
            href="/projects"
            className={navClass(pathname.startsWith("/projects"))}
          >
            <Zap className="w-4 h-4" />
            Projects
          </Link>
          <div className="linear-sidebar-item opacity-60 pointer-events-none">
            <Compass className="w-4 h-4" />
            Views
          </div>
          <Link href="/roadmaps" className={navClass(pathname.startsWith("/roadmaps"))}>
            <Calendar className="w-4 h-4" />
            Roadmaps
          </Link>
        </div>

        <div>
          <p className="px-3 text-[10px] font-bold text-linear-text-muted uppercase tracking-widest mb-2">
            Personal
          </p>
          <div className="space-y-1">
            <Link
              href="/my-issues"
              className={navClass(pathname.startsWith("/my-issues"))}
            >
              <User className="w-4 h-4" />
              My Issues
            </Link>
            <Link
              href="/integrations"
              className={navClass(pathname.startsWith("/integrations"))}
            >
              <Zap className="w-4 h-4" />
              Integrations
            </Link>
            <Link
              href="/settings"
              className={navClass(pathname.startsWith("/settings"))}
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-linear-border space-y-1">
        {canInvite ? (
          <div className="linear-sidebar-item" onClick={() => setInviteOpen(true)}>
            <Users className="w-4 h-4" />
            Invite People
          </div>
        ) : null}
        <div
          className="linear-sidebar-item text-red-500 hover:bg-red-500/10"
          onClick={() => {
            void (async () => {
              let ok = true;
              try {
                await logout();
              } catch {
                ok = false;
              } finally {
                queryClient.clear();
              }
              showToast(
                ok ? "Logged out successfully" : "Signed out on this device; the server could not be reached",
                ok ? "success" : "error",
              );
              router.push("/");
            })();
          }}
        >
          <LogOut className="w-4 h-4" />
          Logout
        </div>
      </div>
    </aside>
  );
}
