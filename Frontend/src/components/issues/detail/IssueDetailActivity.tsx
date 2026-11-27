"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AtSign, MessageSquare, Paperclip, Pencil, Send, Smile, X } from "lucide-react";
import { CommentEmojiPicker } from "@/components/issues/detail/CommentEmojiPicker";
import { issueDetailFocusWithinFieldShell } from "@/components/issues/detail/issueDetailPropertySelectStyles";
import { apiJson, apiOrigin, apiUploadFile } from "@/lib/api-client";
import type { IssueAttachment, IssueComment, IssueDetail } from "@/types/issue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUIStore } from "@/stores/useUIStore";
function resolveHref(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${apiOrigin()}${url.startsWith("/") ? url : `/${url}`}`;
}

export function IssueDetailActivity({
  issue,
  onRefresh,
}: {
  issue: IssueDetail;
  onRefresh: () => Promise<void>;
}) {
  const showToast = useUIStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactionRowId, setReactionRowId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [patchingCommentId, setPatchingCommentId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const insertAtCursor = (insert: string) => {
    const el = textareaRef.current;
    if (!el) {
      setComment((prev) => prev + insert);
      return;
    }
    const start = el.selectionStart ?? comment.length;
    const end = el.selectionEnd ?? comment.length;
    setComment((prev) => prev.slice(0, start) + insert + prev.slice(end));
    const caret = start + insert.length;
    queueMicrotask(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  useEffect(() => {
    if (!emojiOpen && !reactionRowId) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (emojiOpen && !t.closest("[data-emoji-picker]")) setEmojiOpen(false);
      if (reactionRowId && !t.closest("[data-comment-emoji-picker]")) {
        setReactionRowId(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [emojiOpen, reactionRowId]);

  const patchComment = async (commentId: string, body: string) => {
    setPatchingCommentId(commentId);
    try {
      const r = await apiJson<IssueDetail>(
        `/api/issues/${encodeURIComponent(issue.id)}/comments/${encodeURIComponent(commentId)}`,
        { method: "PATCH", body: { body } },
      );
      if (r.success) {
        setReactionRowId(null);
        setEditingId(null);
        await onRefresh();
      } else {
        showToast(r.error, "error");
      }
    } finally {
      setPatchingCommentId(null);
    }
  };

  const replyTo = (c: IssueComment) => {
    const handle = c.authorName.trim().replace(/\s+/g, "") || "user";
    insertAtCursor(`@${handle} `);
    textareaRef.current?.focus();
    document.getElementById("issue-section-activity")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  };

  const [previewState, setPreviewState] = useState<{
    files: File[];
    urls: (string | null)[];
  }>({ files: [], urls: [] });
  // Only use URLs created for the current file list (avoids a one-render mismatch after edits).
  const pendingImagePreviewUrls =
    previewState.files === pendingFiles ? previewState.urls : [];

  // Object URLs are created and revoked in the same effect so StrictMode's mount/unmount/mount
  // cycle never leaves the previews pointing at already-revoked URLs.
  useEffect(() => {
    const urls = pendingFiles.map((f) =>
      f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
    );
    setPreviewState({ files: pendingFiles, urls });
    return () => {
      urls.forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
    };
  }, [pendingFiles]);

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = async () => {
    const text = comment.trim();
    if ((!text && pendingFiles.length === 0) || busy) return;
    setBusy(true);
    try {
      const attachments: IssueAttachment[] = [];
      for (const file of pendingFiles) {
        const up = await apiUploadFile(file);
        if (!up.success) {
          showToast(up.error, "error");
          return;
        }
        attachments.push({
          id: crypto.randomUUID(),
          filename: up.data.filename,
          size: up.data.size,
          mimeType: up.data.mimeType,
          url: up.data.url,
        });
      }
      const r = await apiJson<IssueDetail>(`/api/issues/${encodeURIComponent(issue.id)}/comments`, {
        method: "POST",
        body: { body: text, attachments },
      });
      if (r.success) {
        setComment("");
        setPendingFiles([]);
        if (fileRef.current) fileRef.current.value = "";
        await onRefresh();
      } else {
        showToast(r.error, "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="issue-section-activity" className="scroll-mt-28 space-y-4">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-linear-text-muted">
        Activity
      </h3>
      <div className="space-y-4">
        {issue.comments.map((c: IssueComment) => (
          <div key={c.id} className="group flex gap-4">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-[var(--border)] shrink-0 relative">
              <Image
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(c.avatarSeed)}`}
                alt={c.authorName}
                width={32}
                height={32}
                className="object-cover w-full h-full"
                unoptimized
              />
            </div>
            <div className="flex-1 space-y-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{c.authorName}</span>
                  <span className="text-[10px] text-linear-text-muted">{c.timeLabel}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {user?.id === c.authorUserId ? (
                    <button
                      type="button"
                      disabled={patchingCommentId === c.id}
                      onClick={() => {
                        setEditingId(c.id);
                        setEditDraft(c.body);
                        setReactionRowId(null);
                      }}
                      className="cursor-pointer rounded p-1 text-linear-text-muted transition-colors hover:bg-white/[0.06] hover:text-[var(--text)] disabled:opacity-50"
                      aria-label="Edit comment"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  ) : null}
                  {user?.id === c.authorUserId ? (
                  <div className="relative" data-comment-emoji-picker>
                    <button
                      type="button"
                      disabled={patchingCommentId === c.id}
                      onClick={() =>
                        setReactionRowId((prev) => (prev === c.id ? null : c.id))
                      }
                      className="cursor-pointer rounded p-1 text-linear-text-muted transition-colors hover:bg-white/[0.06] hover:text-[var(--text)] disabled:opacity-50"
                      aria-label="Add emoji to comment"
                      title="Emoji"
                    >
                      <Smile className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    {reactionRowId === c.id ? (
                      <div
                        className="absolute right-0 z-[100] w-[min(280px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-2xl ring-1 ring-black/15 dark:ring-white/10 top-[calc(100%+8px)]"
                        data-comment-emoji-picker
                      >
                        <CommentEmojiPicker
                          onPick={(emoji) => {
                            const base = c.body.trimEnd();
                            const next = base ? `${base} ${emoji}` : emoji;
                            void patchComment(c.id, next);
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => replyTo(c)}
                    className="cursor-pointer rounded p-1 text-linear-text-muted transition-colors hover:bg-white/[0.06] hover:text-[var(--text)]"
                    aria-label="Reply in composer"
                    title="Reply"
                  >
                    <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>
              {editingId === c.id ? (
                <div className="space-y-2 pt-0.5">
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    className="min-h-[88px] w-full resize-y rounded-lg border border-[var(--border)] bg-white/[0.03] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-linear-text-muted/55 focus:border-[var(--primary)] focus:outline-none"
                    disabled={patchingCommentId === c.id}
                    aria-label="Edit comment"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={patchingCommentId === c.id}
                      onClick={() => {
                        setEditingId(null);
                        setEditDraft("");
                      }}
                      className="cursor-pointer rounded-md px-3 py-1.5 text-xs text-linear-text-muted transition-colors hover:bg-white/[0.06] hover:text-[var(--text)] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={
                        patchingCommentId === c.id ||
                        (!editDraft.trim() && (c.attachments ?? []).length === 0)
                      }
                      onClick={() => void patchComment(c.id, editDraft)}
                      className="cursor-pointer rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white transition-[opacity,filter] hover:brightness-110 disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-linear-text-muted leading-relaxed whitespace-pre-wrap">
                  {c.body}
                </p>
              )}
              {(c.attachments ?? []).length > 0 ? (
                <ul className="flex flex-wrap gap-2 pt-1">
                  {(c.attachments ?? []).map((a) => (
                    <li key={a.id}>
                      {a.mimeType.startsWith("image/") ? (
                        <a href={resolveHref(a.url)} target="_blank" rel="noreferrer" className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element -- remote user-uploaded URLs */}
                          <img
                            src={resolveHref(a.url)}
                            alt={a.filename}
                            className="max-h-40 rounded-md border border-[var(--border)] object-contain"
                          />
                        </a>
                      ) : (
                        <a
                          href={resolveHref(a.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-linear-accent underline"
                        >
                          {a.filename}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white/5 text-[10px] font-bold">
          ME
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`flex w-full flex-col overflow-visible rounded-xl border border-[var(--border)] bg-white/[0.03] ${issueDetailFocusWithinFieldShell}`}
          >
            <div className="min-w-0 overflow-hidden rounded-t-xl">
            <textarea
              ref={textareaRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || busy) return;
                if (e.metaKey || e.ctrlKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Add a comment..."
              className="min-h-[120px] w-full shrink-0 resize-none border-0 bg-transparent px-4 pb-2 pt-4 text-sm text-[var(--text)] transition-colors duration-200 placeholder:text-linear-text-muted/55 focus:outline-none"
            />
            {pendingFiles.length > 0 ? (
              <div className="flex flex-wrap gap-3 px-4 py-2.5">
                {pendingFiles.map((f, index) => {
                  const previewUrl = pendingImagePreviewUrls[index];
                  if (previewUrl) {
                    return (
                      <div
                        key={`${f.name}-${f.size}-${index}`}
                        className="relative inline-flex max-w-full flex-col gap-1.5"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                        <img
                          src={previewUrl}
                          alt=""
                          className="max-h-28 max-w-[200px] rounded-md border border-[var(--border)] object-contain"
                        />
                        <div className="flex max-w-[200px] items-center justify-between gap-2 text-[11px] text-[var(--text)]">
                          <span className="min-w-0 truncate" title={f.name}>
                            {f.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removePendingFile(index)}
                            className="shrink-0 rounded p-0.5 text-linear-text-muted transition-colors hover:bg-white/[0.08] hover:text-[var(--text)]"
                            aria-label={`Remove ${f.name}`}
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <span
                      key={`${f.name}-${f.size}-${index}`}
                      className="inline-flex max-w-full items-center gap-1 rounded-md border border-[var(--border)] bg-white/[0.05] py-1 pl-2.5 pr-1 text-[11px] text-[var(--text)]"
                    >
                      <span className="min-w-0 truncate" title={f.name}>
                        {f.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePendingFile(index)}
                        className="shrink-0 rounded p-0.5 text-linear-text-muted transition-colors hover:bg-white/[0.08] hover:text-[var(--text)]"
                        aria-label={`Remove ${f.name}`}
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : null}
            </div>
            <div className="relative z-20 flex shrink-0 items-center justify-end gap-1 rounded-b-xl border-t border-[var(--border)]/80 bg-[var(--card)]/95 px-2 py-1.5 backdrop-blur-sm">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  fileRef.current?.click();
                }}
                className="rounded-md p-1.5 text-linear-text-muted transition-colors hover:bg-white/[0.06] hover:text-[var(--text)] disabled:opacity-50"
                aria-label="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  insertAtCursor("@");
                }}
                className="rounded-md p-1.5 text-linear-text-muted transition-colors hover:bg-white/[0.06] hover:text-[var(--text)] disabled:opacity-50"
                aria-label="Insert mention"
                title="Insert @"
              >
                <AtSign className="h-4 w-4" />
              </button>
              <div className="relative" data-emoji-picker>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEmojiOpen((o) => !o)}
                  className={`rounded-md p-1.5 transition-colors hover:bg-white/[0.06] hover:text-[var(--text)] disabled:opacity-50 ${
                    emojiOpen ? "bg-white/[0.08] text-[var(--text)]" : "text-linear-text-muted"
                  }`}
                  aria-expanded={emojiOpen}
                  aria-label="Insert emoji"
                  title="Emoji"
                >
                  <Smile className="h-4 w-4" />
                </button>
                {emojiOpen ? (
                  <div
                    className="absolute right-0 z-[100] w-[min(280px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-2xl ring-1 ring-black/15 dark:ring-white/10 bottom-[calc(100%+12px)]"
                    data-emoji-picker
                  >
                    <CommentEmojiPicker
                      onPick={(emoji) => {
                        insertAtCursor(emoji);
                        setEmojiOpen(false);
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                disabled={
                  busy || (!comment.trim() && pendingFiles.length === 0)
                }
                onClick={() => void send()}
                className="linear-accent-fill ml-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-md transition-[opacity,filter] hover:brightness-110 disabled:opacity-50"
                aria-label="Send"
                title="Send (⌘ or Ctrl + Enter)"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              const list = e.target.files;
              if (!list?.length) return;
              setPendingFiles((prev) => [...prev, ...Array.from(list)]);
            }}
          />
        </div>
      </div>
    </section>
  );
}
