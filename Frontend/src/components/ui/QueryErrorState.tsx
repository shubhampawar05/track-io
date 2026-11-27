"use client";

import { RotateCw } from "lucide-react";

/** Inline "failed to load" state with a retry action (distinct from an empty state). */
export function QueryErrorState({
  message = "Something went wrong while loading.",
  error,
  onRetry,
  className = "",
}: {
  message?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const detail = error instanceof Error && error.message ? error.message : null;
  return (
    <div
      role="alert"
      className={`rounded-xl border border-dashed border-(--border) p-10 text-center space-y-4 ${className}`.trim()}
    >
      <p className="text-sm text-(--text)">{message}</p>
      {detail ? <p className="text-xs text-linear-text-muted">{detail}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white/5 border border-(--border) text-sm hover:text-(--text) hover:border-linear-accent/50 transition-all duration-200"
        >
          <RotateCw className="w-4 h-4" />
          Retry
        </button>
      ) : null}
    </div>
  );
}
