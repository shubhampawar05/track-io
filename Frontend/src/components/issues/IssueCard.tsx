"use client";

import type { KeyboardEvent } from "react";
import { motion } from "motion/react";
import type { Issue } from "@/types/issue";
import {
  getIssuePriorityVisual,
  listRowAssigneeTooltip,
} from "@/utils/issuePriority";
import { PriorityMenuGlyph } from "@/components/issues/PriorityMenuGlyph";

export function IssueCard({
  issue,
  onClick,
  isLastOpened = false,
  interactive = true,
}: {
  issue: Issue;
  onClick: () => void;
  isLastOpened?: boolean;
  /**
   * When false the card is not focusable itself (e.g. inside a sortable wrapper that
   * already is the focusable button), so there is a single tab stop per card.
   */
  interactive?: boolean;
}) {
  const pv = getIssuePriorityVisual(issue.priority);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      {...(interactive
        ? {
            role: "button",
            tabIndex: 0,
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              e.stopPropagation();
              onClick();
            },
          }
        : {})}
      className={`group cursor-pointer rounded-lg p-4 space-y-3 border border-solid transition-[border-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--primary)_50%,transparent)] hover:shadow-[0_8px_28px_color-mix(in_srgb,var(--primary)_25%,transparent)] ${
        isLastOpened
          ? "border-(--border) border-l-2 border-l-(--primary) bg-white/4"
          : "bg-(--card) border-(--border)"
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <span className="text-[10px] font-mono text-linear-text-muted">
          {issue.key ?? issue.id}
        </span>
        <div className="group/priority relative flex shrink-0 items-center justify-center pt-0.5">
          <PriorityMenuGlyph
            priority={issue.priority}
            className="h-3.5 w-3.5 shrink-0 stroke-[2.25] transition-transform duration-150 ease-out group-hover/priority:scale-[1.25]"
          />
          <span
            className="pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-[#111118] px-2 py-1 text-[10px] font-medium text-white/90 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 ease-out group-hover/priority:opacity-100"
            role="tooltip"
          >
            {pv.label}
          </span>
        </div>
      </div>
      <h4 className="text-sm font-medium leading-relaxed text-(--text) no-underline decoration-2 underline-offset-2 decoration-[color-mix(in_srgb,var(--text)_30%,transparent)] transition-[color,text-decoration-color,opacity] duration-150 ease-out opacity-90 group-hover:opacity-100 group-hover:underline dark:opacity-80 dark:decoration-white/30 dark:group-hover:opacity-100">
        {issue.title}
      </h4>
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <span className="rounded border border-[color-mix(in_srgb,var(--primary)_22%,transparent)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-2 py-0.5 text-[10px] text-linear-text-muted">
            {issue.label}
          </span>
          <span className="text-[10px] text-linear-text-muted">
            {issue.date}
          </span>
        </div>

        <div className="group/assignee relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-linear-text-muted dark:bg-transparent">
          <span
            className={`transition-transform duration-150 ease-out group-hover/assignee:scale-[1.25] border border-(--border) rounded-full p-1 ${listRowAssigneeTooltip(issue) === "Unassigned" ? "size-6 flex items-center justify-center" : ""}`}
          >
            {issue.assignee}
          </span>
          <span
            className="pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-[#111118] px-2 py-1 text-[10px] font-medium text-white/90 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 ease-out group-hover/assignee:opacity-100"
            role="tooltip"
          >
            {listRowAssigneeTooltip(issue)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
