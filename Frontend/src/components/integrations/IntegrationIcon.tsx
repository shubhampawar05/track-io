"use client";

import { Code2, MessageSquare, MessagesSquare } from "lucide-react";
import type { IntegrationIconId } from "@/types/issue";

export function IntegrationIcon({ id }: { id: IntegrationIconId }) {
  const cls = "w-6 h-6";
  if (id === "github") return <Code2 className={cls} aria-hidden />;
  if (id === "slack") return <MessagesSquare className={cls} aria-hidden />;
  return <MessageSquare className={cls} aria-hidden />;
}
