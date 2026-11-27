"use client";

import { ExternalLink, GitBranch } from "lucide-react";
import type { IssueDetail } from "@/types/issue";
import { useUIStore } from "@/stores/useUIStore";
import Link from "next/link";

export function IssueDetailGithub({ issue }: { issue: IssueDetail }) {
  const showToast = useUIStore((s) => s.showToast);
  const links = issue.githubLinks ?? [];
  const suggestedBranch = `${(issue.key ?? issue.id).toLowerCase().replace(/\s+/g, "-")}-`;

  function copySuggestedBranch() {
    void navigator.clipboard.writeText(suggestedBranch);
    showToast("Branch prefix copied", "success");
  }

  return (
    <div className="space-y-4 pt-4 border-t border-[var(--border)]">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-linear-text-muted">
        GitHub
      </h3>
      <p className="text-[11px] text-linear-text-muted leading-relaxed text-[12px]">
        PRs and branches appear here when GitHub sends webhooks. Include the
        issue key (e.g.{" "}
        <span className="font-mono text-[var(--text)]">
          {issue.key ?? issue.id}
        </span>
        ) in the branch name or PR title. Set the repo on the project and
        configure the webhook from{" "}
        <Link href="/integrations" className="text-indigo-400 hover:underline">
          Integrations
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={() => copySuggestedBranch()}
        className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
      >
        <GitBranch className="w-3 h-3" aria-hidden />
        Copy branch prefix: <span className="font-mono">{suggestedBranch}</span>
      </button>
      {links.length === 0 ? (
        <p className="text-[11px] text-linear-text-muted">
          No GitHub links yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {links.map((l) => (
            <li
              key={l.id}
              className="flex items-start justify-between gap-2 rounded-md border border-[var(--border)] bg-white/[0.03] px-2 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-linear-text-muted uppercase text-[9px]">
                    {l.kind === "pull_request" ? "PR" : "Branch"}
                  </span>
                  {l.merged ? (
                    <span className="text-[9px] px-1 rounded bg-violet-500/20 text-violet-300">
                      merged
                    </span>
                  ) : (
                    <span className="text-[9px] px-1 rounded bg-white/10 text-linear-text-muted">
                      {l.state}
                    </span>
                  )}
                  {l.source === "webhook" ? (
                    <span className="text-[9px] text-linear-text-muted">
                      auto
                    </span>
                  ) : null}
                </div>
                <a
                  href={l.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-400 hover:underline flex items-center gap-1 truncate"
                >
                  {l.title ||
                    `${l.owner}/${l.repo}${l.pullNumber != null ? `#${l.pullNumber}` : `@${l.headRef}`}`}
                  <ExternalLink className="w-3 h-3 shrink-0" aria-hidden />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
