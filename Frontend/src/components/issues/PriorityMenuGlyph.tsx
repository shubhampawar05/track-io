"use client";

import {
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Equal,
} from "lucide-react";
import { normalizeIssuePriority } from "@/utils/issuePriority";
import { cn } from "@/lib/utils";

export function PriorityMenuGlyph({
  priority,
  className,
}: {
  priority: unknown;
  className?: string;
}) {
  const normalized = normalizeIssuePriority(priority);
  const Icon =
    normalized === "urgent"
      ? ChevronsUp
      : normalized === "high"
        ? ChevronUp
        : normalized === "medium"
          ? Equal
          : normalized === "low"
            ? ChevronDown
            : ChevronsDown;
  return (
    <Icon className={cn("shrink-0 stroke-2", className)} aria-hidden />
  );
}
