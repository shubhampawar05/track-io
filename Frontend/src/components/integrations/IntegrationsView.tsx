"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IntegrationIcon } from "@/components/integrations/IntegrationIcon";
import { QueryErrorState } from "@/components/ui/QueryErrorState";
import {
  disconnectGithubIntegration,
  fetchGithubIntegrationStatus,
  fetchGithubOauthUrl,
  setupGithubWebhook,
} from "@/lib/github-integration";
import { upcomingIntegrationMeta } from "@/lib/integration-meta";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { useUIStore } from "@/stores/useUIStore";
const GITHUB_DESCRIPTION = "Link your GitHub account to this workspace for future automations.";

export function IntegrationsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const organizations = useAuthStore((s) => s.organizations);
  const showToast = useUIStore((s) => s.showToast);
  const canManageGithub = useMemo(() => {
    if (!organizationId || !organizations.length) return false;
    const role = organizations.find((o) => o.id === organizationId)?.role;
    return role === "owner" || role === "admin";
  }, [organizationId, organizations]);
  const [connectBusy, setConnectBusy] = useState(false);
  const [lastWebhook, setLastWebhook] = useState<{ webhookUrl: string; secret: string } | null>(null);
  const githubQuery = useQuery({
    queryKey: ["github-integration", organizationId],
    queryFn: async ({ queryKey }) => {
      const r = await fetchGithubIntegrationStatus(queryKey[1]);
      if (!r.success) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(organizationId),
  });
  const webhookSetupMutation = useMutation({
    mutationFn: async () => {
      const r = await setupGithubWebhook();
      if (!r.success) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (data) => {
      setLastWebhook({ webhookUrl: data.webhookUrl, secret: data.secret });
      void queryClient.invalidateQueries({ queryKey: ["github-integration", organizationId] });
      showToast("Webhook URL and secret generated — copy them now", "success");
    },
    onError: (e: Error) => {
      showToast(e.message || "Could not create webhook credentials", "error");
    },
  });
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const r = await disconnectGithubIntegration();
      if (!r.success) throw new Error(r.error);
      return r.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["github-integration", organizationId] });
      showToast("GitHub disconnected", "success");
    },
    onError: (e: Error) => {
      showToast(e.message || "Could not disconnect", "error");
    },
  });
  useEffect(() => {
    const gh = searchParams.get("github");
    if (gh === "connected") {
      showToast("GitHub connected", "success");
      void queryClient.invalidateQueries({ queryKey: ["github-integration", organizationId] });
      router.replace("/integrations", { scroll: false });
    } else if (gh === "error") {
      showToast("GitHub connection failed", "error");
      router.replace("/integrations", { scroll: false });
    }
  }, [searchParams, showToast, queryClient, organizationId, router]);
  const connected = upcomingIntegrationMeta.filter((i) => i.connected);
  const available = upcomingIntegrationMeta.filter((i) => !i.connected);
  const githubConnected = githubQuery.data?.connected ?? false;
  const githubLogin = githubQuery.data?.githubLogin ?? null;
  const webhookConfigured = githubQuery.data?.webhookConfigured ?? false;
  const webhookUrlFromApi = githubQuery.data?.webhookUrl ?? null;
  const showConnectedBlock =
    Boolean(organizationId && githubQuery.isPending) || githubConnected || connected.length > 0;
  async function onConnectGithub() {
    if (!organizationId || !canManageGithub) return;
    setConnectBusy(true);
    try {
      const r = await fetchGithubOauthUrl();
      if (!r.success) {
        showToast(r.error, "error");
        return;
      }
      window.location.href = r.data.url;
    } finally {
      setConnectBusy(false);
    }
  }
  return (
    <div className="p-8 w-full space-y-12">
      <div>
        <h2 className="text-3xl font-semibold mb-2">Integrations</h2>
        <p className="text-linear-text-muted">
          Connect your tools to automate workflows and unify your engineering data.
        </p>
      </div>
      {showConnectedBlock ? (
        <div className="space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-linear-text-muted">Connected</h3>
          <div className="grid grid-cols-1 gap-4">
            {githubQuery.isPending && organizationId ? (
              <div className="linear-card p-6 flex items-center gap-3 text-linear-text-muted text-sm">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Loading integrations…
              </div>
            ) : null}
            {githubConnected ? (
              <div className="linear-card p-6 space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-[var(--border)]">
                      <IntegrationIcon id="github" />
                    </div>
                    <div>
                      <h4 className="font-semibold">GitHub</h4>
                      <p className="text-xs text-green-500 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" aria-hidden />
                        Connected as {githubLogin ?? "GitHub user"}
                      </p>
                    </div>
                  </div>
                  {canManageGithub ? (
                    <div className="flex gap-3 flex-wrap">
                      <button
                        type="button"
                        disabled={webhookSetupMutation.isPending}
                        onClick={() => webhookSetupMutation.mutate()}
                        className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-[var(--border)] rounded-md text-xs font-medium transition-all duration-200 disabled:opacity-50"
                      >
                        {webhookConfigured ? "Rotate webhook secret" : "Create webhook URL & secret"}
                      </button>
                      <button
                        type="button"
                        disabled={disconnectMutation.isPending}
                        onClick={() => disconnectMutation.mutate()}
                        className="px-4 py-1.5 text-red-500 hover:bg-red-500/10 rounded-md text-xs font-medium transition-all duration-200 disabled:opacity-50"
                      >
                        {disconnectMutation.isPending ? "Disconnecting…" : "Disconnect"}
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="text-[11px] text-linear-text-muted space-y-2 border-t border-[var(--border)] pt-4">
                  <p>
                    In GitHub → repository → <strong className="text-[var(--text)]">Settings → Webhooks</strong>, add a
                    webhook with the URL below, content type <span className="font-mono">application/json</span>, the
                    secret below, and events: <span className="font-mono">pull_request</span>,{" "}
                    <span className="font-mono">push</span>. Set each project&apos;s GitHub repo under the project
                    settings (gear) so events match the right workspace.
                  </p>
                  {(lastWebhook?.webhookUrl || webhookUrlFromApi) ? (
                    <div className="space-y-1 font-mono text-[10px] break-all bg-black/30 rounded-md p-3 border border-[var(--border)]">
                      <div>
                        <span className="text-linear-text-muted">URL: </span>
                        {lastWebhook?.webhookUrl ?? webhookUrlFromApi}
                      </div>
                      {lastWebhook?.secret ? (
                        <div>
                          <span className="text-linear-text-muted">Secret (copy now): </span>
                          {lastWebhook.secret}
                        </div>
                      ) : webhookConfigured ? (
                        <p className="text-amber-400/90">
                          Secret was shown only when created. Rotate to get a new secret.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {connected.map((app) => (
              <div
                key={app.id}
                className="linear-card p-6 flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-[var(--border)]">
                    <IntegrationIcon id={app.icon} />
                  </div>
                  <div>
                    <h4 className="font-semibold">{app.name}</h4>
                    <p className="text-xs text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" aria-hidden />
                      Connected
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="space-y-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-linear-text-muted">Available</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {organizationId && githubQuery.isError ? (
            <QueryErrorState
              className="linear-card"
              message="Could not load GitHub integration status."
              error={githubQuery.error}
              onRetry={() => void githubQuery.refetch()}
            />
          ) : !githubConnected && organizationId && !githubQuery.isPending ? (
            <div className="linear-card p-6 flex flex-col justify-between gap-6 hover:border-linear-accent/30 transition-all duration-200">
              <div className="flex items-center justify-between gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-[var(--border)]">
                  <IntegrationIcon id="github" />
                </div>
                <button
                  type="button"
                  disabled={!canManageGithub || connectBusy}
                  onClick={() => void onConnectGithub()}
                  className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-[var(--border)] rounded-md text-xs font-medium transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {connectBusy ? "Redirecting…" : "Connect"}
                </button>
              </div>
              <div>
                <h4 className="font-semibold mb-1">GitHub</h4>
                <p className="text-xs text-linear-text-muted leading-relaxed">{GITHUB_DESCRIPTION}</p>
                {!canManageGithub ? (
                  <p className="text-xs text-linear-text-muted mt-2">Only workspace owners and admins can connect.</p>
                ) : null}
              </div>
            </div>
          ) : null}
          {available.map((app) => (
            <div
              key={app.id}
              className="linear-card p-6 flex flex-col justify-between gap-6 hover:border-linear-accent/30 transition-all duration-200"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-[var(--border)]">
                  <IntegrationIcon id={app.icon} />
                </div>
                <span className="px-4 py-1.5 border border-[var(--border)] rounded-md text-xs font-medium text-linear-text-muted opacity-60">
                  Coming soon
                </span>
              </div>
              <div>
                <h4 className="font-semibold mb-1">{app.name}</h4>
                <p className="text-xs text-linear-text-muted leading-relaxed">{app.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}