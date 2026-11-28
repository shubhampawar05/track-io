"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { AlertCircle, List as ListIcon, Paperclip, Plus, Trash2, X } from "lucide-react";
import { apiJson, apiBaseUrl, apiUploadFile } from "@/lib/api-client";
import type { IssueAttachment, IssueDetail } from "@/types/issue";
import { useUIStore } from "@/stores/useUIStore";
import {
  formatMaxUploadSize,
  MAX_ISSUE_ATTACHMENTS,
  MAX_UPLOAD_BYTES,
} from "@/lib/attachment-limits";
import { Button } from "@/components/ui/button";

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function resolveHref(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes("\n")) return null;
  if (trimmed.startsWith("javascript:")) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${apiBaseUrl()}${normalized}`;
}

function normalizeDisplayFilename(name: string): string {
  const raw = name.trim();
  if (!raw) return "file";
  // Recover common mojibake like "â€¯" caused by UTF-8 bytes interpreted as Latin-1.
  if (/[ÃÂâ]/.test(raw)) {
    try {
      const bytes = Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
      const decoded = new TextDecoder("utf-8").decode(bytes).trim();
      if (decoded && decoded !== raw && !decoded.includes("\uFFFD")) return decoded;
    } catch {
      // Ignore and fallback to raw
    }
  }
  return raw;
}

function shortenFilename(name: string, maxBaseLength = 26): string {
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === name.length - 1) {
    return name.length > maxBaseLength ? `${name.slice(0, maxBaseLength)}...` : name;
  }
  const baseRaw = name.slice(0, lastDot);
  const base = baseRaw
    .replace(/\s+at\s+\d{1,2}([.:]\d{2}){1,2}\s*(AM|PM)?$/i, "")
    .trim();
  const ext = name.slice(lastDot);
  if (base.length <= maxBaseLength) return `${base}${ext}`;
  return `${base.slice(0, maxBaseLength)}...${ext}`;
}

export function IssueDetailAttachments({
  issue,
  onRefresh,
}: {
  issue: IssueDetail;
  onRefresh: () => Promise<void>;
}) {
  const showToast = useUIStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ href: string; filename: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length || busy) return;
    const remaining = MAX_ISSUE_ATTACHMENTS - issue.attachments.length;
    if (remaining <= 0) {
      showToast(`Maximum ${MAX_ISSUE_ATTACHMENTS} attachments per issue`, "error");
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      showToast(`Only ${remaining} more attachment(s) allowed on this issue`, "error");
    }
    for (const file of toUpload) {
      if (file.size > MAX_UPLOAD_BYTES) {
        showToast(`"${file.name}" exceeds ${formatMaxUploadSize()}`, "error");
        return;
      }
    }
    setBusy(true);
    try {
      let uploaded = 0;
      const failed: string[] = [];
      for (let i = 0; i < toUpload.length; i += 1) {
        const file = toUpload[i];
        const up = await apiUploadFile(file);
        if (!up.success) {
          failed.push(file.name);
          showToast(`Failed to upload "${file.name}": ${up.error}`, "error");
          continue;
        }
        const r = await apiJson(`/api/issues/${encodeURIComponent(issue.id)}/attachments`, {
          method: "POST",
          body: {
            filename: up.data.filename,
            size: up.data.size,
            mimeType: up.data.mimeType,
            url: up.data.url,
          },
        });
        if (!r.success) {
          failed.push(file.name);
          showToast(`Failed to attach "${file.name}": ${r.error}`, "error");
          continue;
        }
        uploaded += 1;
      }
      if (uploaded > 0) {
        await onRefresh();
      }
      if (uploaded > 0 && failed.length > 0) {
        showToast(`${uploaded} file(s) uploaded, ${failed.length} failed`, "error");
      } else if (uploaded > 0) {
        showToast(`${uploaded} file(s) uploaded`);
      } else if (failed.length > 0) {
        showToast("No files were uploaded", "error");
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAttachment = async (attachment: IssueAttachment) => {
    if (busy || removingId) return;
    setRemovingId(attachment.id);
    try {
      const r = await apiJson(`/api/issues/${encodeURIComponent(issue.id)}/attachments/${encodeURIComponent(attachment.id)}`, {
        method: "DELETE",
      });
      if (!r.success) {
        showToast(r.error, "error");
        return;
      }
      await onRefresh();
      showToast(`Removed "${attachment.filename}"`);
    } finally {
      setRemovingId(null);
    }
  };

  const openPreview = (href: string, filename: string) => {
    setPreview({ href, filename });
  };

  return (
    <section id="issue-section-files" className="scroll-mt-28 space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-linear-text-muted">
              Attachments
            </h3>
            <p className="mt-3 max-w-md text-[10px] leading-relaxed text-linear-text-muted">
              PDF or images, up to {formatMaxUploadSize()} each, max {MAX_ISSUE_ATTACHMENTS} files.
            </p>
          </div>
          <div className="shrink-0">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => void addFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || Boolean(removingId)}
              onClick={() => inputRef.current?.click()}
              className="gap-2 font-semibold text-foreground"
            >
              <Plus className="text-primary" strokeWidth={2.5} aria-hidden />
              Add file
            </Button>
          </div>
        </div>
        {issue.attachments.length === 0 ? (
          <div className="rounded-lg border border-[var(--border)] bg-white/[0.02] p-6 text-center text-xs text-linear-text-muted">
            No files attached yet.
          </div>
        ) : (
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pr-2 pb-1">
            {issue.attachments.map((a: IssueAttachment) => {
              const href = resolveHref(a.url);
              const isPdf = a.mimeType === "application/pdf";
              const isImage = a.mimeType.startsWith("image/");
              const isRemovingThis = removingId === a.id;
              const displayName = normalizeDisplayFilename(a.filename);
              const shortName = shortenFilename(displayName);
              return (
                <div
                  key={a.id}
                  className={`${isImage ? "w-fit" : "w-[min(22rem,85vw)]"} shrink-0 snap-start flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/[0.02] p-4 transition-colors ${href ? "hover:border-violet-500/35 hover:bg-white/[0.04]" : "opacity-70"}`}
                >
                  {href ? (
                    isImage ? (
                      <div className="group flex min-w-0 flex-1 flex-col gap-2">
                        <div className="relative w-fit">
                          <button
                            type="button"
                            onClick={() => openPreview(href, a.filename)}
                            aria-label={`Preview ${displayName} (${formatSize(a.size)})`}
                            className="block"
                          >
                            <Image
                              src={href}
                              alt={displayName}
                              width={128}
                              height={128}
                              unoptimized
                              className="h-40 w-50 rounded-lg border border-[var(--border)] object-cover"
                            />
                          </button>
                          <button
                            type="button"
                            disabled={busy || Boolean(removingId)}
                            onClick={() => void removeAttachment(a)}
                            aria-label={`Remove ${displayName}`}
                            title={isRemovingThis ? "Removing..." : "Remove attachment"}
                            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/55 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-2 break-words text-sm font-medium" title={displayName}>
                            {shortName}
                          </p>
                          <p className="text-[10px] text-linear-text-muted">
                            {formatSize(a.size)} · {a.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${displayName} (${formatSize(a.size)})`}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                            isPdf ? "bg-red-500/12 text-red-400" : "bg-blue-500/12 text-blue-400"
                          }`}
                        >
                          {isPdf ? (
                            <AlertCircle className="h-5 w-5" />
                          ) : (
                            <ListIcon className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 break-words text-sm font-medium" title={displayName}>
                            {shortName}
                          </p>
                          <p className="text-[10px] text-linear-text-muted">
                            {formatSize(a.size)} · {a.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"}
                          </p>
                        </div>
                        <Paperclip
                          className="h-3.5 w-3.5 shrink-0 text-linear-text-muted opacity-50"
                          aria-hidden
                        />
                      </a>
                    )
                  ) : (
                    <div
                      className="flex min-w-0 flex-1 items-center gap-3"
                      aria-disabled
                      title="Invalid file URL"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          isPdf ? "bg-red-500/12 text-red-400" : "bg-blue-500/12 text-blue-400"
                        }`}
                      >
                        {isPdf ? (
                          <AlertCircle className="h-5 w-5" />
                        ) : (
                          <ListIcon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 break-words text-sm font-medium" title={displayName}>
                          {shortName}
                        </p>
                        <p className="text-[10px] text-linear-text-muted">
                          {formatSize(a.size)} · {a.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"}
                        </p>
                      </div>
                    </div>
                  )}
                  {!isImage ? (
                    <button
                      type="button"
                      disabled={busy || Boolean(removingId)}
                      onClick={() => void removeAttachment(a)}
                      aria-label={`Remove ${displayName}`}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.1] text-linear-text-muted transition-colors hover:bg-white/[0.08] hover:text-red-400 disabled:opacity-50"
                      title={isRemovingThis ? "Removing..." : "Remove attachment"}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${preview.filename}`}
          onClick={() => setPreview(null)}
        >
          <div
            className="relative w-full max-w-5xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.1] text-linear-text-muted transition-colors hover:bg-white/[0.08] hover:text-[var(--text)]"
              aria-label="Close image preview"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <Image
              src={preview.href}
              alt={preview.filename}
              width={1600}
              height={1200}
              unoptimized
              className="max-h-[80vh] w-full rounded-lg object-contain"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
