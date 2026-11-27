import { apiJson } from "@/lib/api-client";

export type GithubIntegrationStatus = {
  connected: boolean;
  githubLogin: string | null;
  webhookConfigured: boolean;
  webhookUrl: string | null;
};

export type GithubOauthUrlResponse = { url: string };

export type GithubWebhookSetupResponse = {
  webhookUrl: string;
  secret: string;
};

export function fetchGithubIntegrationStatus(orgId?: string | null) {
  return apiJson<GithubIntegrationStatus>("/api/organizations/github/status", { orgId });
}

export function fetchGithubOauthUrl() {
  return apiJson<GithubOauthUrlResponse>("/api/organizations/github/oauth-url");
}

export function disconnectGithubIntegration() {
  return apiJson<boolean>("/api/organizations/github", { method: "DELETE" });
}

export function setupGithubWebhook() {
  return apiJson<GithubWebhookSetupResponse>("/api/organizations/github/webhook-setup", { method: "POST" });
}
