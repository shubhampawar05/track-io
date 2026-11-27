import type { IntegrationMeta } from "@/types/issue";

/** Placeholder catalog for integrations not yet wired (Slack, Fireflies). GitHub is live via API. */
export const upcomingIntegrationMeta: IntegrationMeta[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Notifications and slash commands.",
    icon: "slack",
    connected: false,
  },
  {
    id: "fireflies",
    name: "Fireflies AI",
    description: "AI transcription & meeting insights.",
    icon: "fireflies",
    connected: false,
  },
];
