"use client";

import {
  CheckCircle2,
  CircleDashed,
  CircleX,
  Inbox,
  ListTodo,
  PlayCircle,
} from "lucide-react";
import type { Status } from "@/types/issue";
import { cn } from "@/lib/utils";

/** Stroke colors for status icons (issue modal, filters, etc.). */
export const ISSUE_STATUS_MENU_COLORS: Record<string, string> = {
  backlog: "#6b7280",
  todo: "#60a5fa",
  "in-progress": "#eab308",
  done: "#22c55e",
  canceled: "#a1a1aa",
};

const STATUS_MENU_ICONS = {
  backlog: Inbox,
  todo: ListTodo,
  "in-progress": PlayCircle,
  done: CheckCircle2,
  canceled: CircleX,
} as const;

type KnownStatusGlyph = keyof typeof STATUS_MENU_ICONS;

export function StatusMenuGlyph({
  status,
  className,
}: {
  status: Status | string;
  className?: string;
}) {
  const key = String(status);
  const Icon =
    key in STATUS_MENU_ICONS
      ? STATUS_MENU_ICONS[key as KnownStatusGlyph]
      : CircleDashed;
  return (
    <Icon
      className={cn("shrink-0 stroke-2", className)}
      style={{ color: ISSUE_STATUS_MENU_COLORS[key] ?? "#6b7280" }}
      aria-hidden
    />
  );
}
