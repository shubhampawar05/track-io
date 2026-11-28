"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import DOMPurify from "isomorphic-dompurify";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Redo2,
  Undo2,
} from "lucide-react";
import { apiBaseUrl, apiUploadFile } from "@/lib/api-client";
import { useUIStore } from "@/stores/useUIStore";

const purifyOpts = {
  ADD_TAGS: ["img", "ul", "ol", "li", "input", "label", "pre", "code"],
  ADD_ATTR: [
    "src",
    "alt",
    "title",
    "class",
    "width",
    "height",
    "type",
    "checked",
    "data-type",
    "disabled",
  ],
};

function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html || "", purifyOpts);
}

export type IssueDescriptionEditorHandle = {
  /** Saves any pending edit now; rejects if the save fails. */
  flush: () => Promise<void>;
};

function reportSaveError(e: unknown) {
  const msg = e instanceof Error && e.message ? e.message : "Could not save description";
  useUIStore.getState().showToast(msg, "error");
}

function toolbarBtn(active: boolean) {
  return active ? "issue-toolbar-icon issue-toolbar-icon-active" : "issue-toolbar-icon";
}

export const IssueDescriptionEditor = forwardRef<
  IssueDescriptionEditorHandle,
  {
    initialHtml: string;
    /** Must reject when the save fails. */
    onSave: (html: string) => Promise<void>;
  }
>(function IssueDescriptionEditor({ initialHtml, onSave }, ref) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** HTML waiting on the debounce timer (flushed on unmount instead of dropped). */
  const pendingHtml = useRef<string | null>(null);
  /** Saves currently in flight. */
  const inFlight = useRef(0);
  /** Last HTML this editor saved successfully (or loaded); used to ignore our own echo. */
  const lastSavedHtml = useRef<string>(sanitizeHtml(initialHtml));
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  /** Runs a save, tracking in-flight state. Rejects on failure. */
  const runSave = useCallback(async (html: string) => {
    inFlight.current += 1;
    try {
      await onSaveRef.current(html);
      lastSavedHtml.current = html;
    } finally {
      inFlight.current -= 1;
    }
  }, []);

  const cancelTimer = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    pendingHtml.current = null;
  }, []);

  const scheduleSave = useCallback(
    (html: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      pendingHtml.current = html;
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        pendingHtml.current = null;
        runSave(html).catch(reportSaveError);
      }, 800);
    },
    [runSave],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TaskList.configure({ HTMLAttributes: { class: "task-list-root" } }),
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Add a description…" }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: sanitizeHtml(initialHtml),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "tiptap min-h-[200px] text-sm text-[var(--text)] leading-relaxed focus:outline-none " +
          "[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 " +
          "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-1 [&_ul]:pl-5 [&_ol]:pl-5 [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2 " +
          "[&_a]:text-[#a78bfa] [&_a]:underline [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-[var(--border)] [&_pre]:bg-black/30 [&_pre]:p-3 [&_pre]:text-xs " +
          "[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:items-start [&_ul[data-type=taskList]_li]:gap-2 " +
          "[&_ul[data-type=taskList]_label]:flex [&_ul[data-type=taskList]_label]:flex-1 [&_ul[data-type=taskList]_input]:mt-1",
      },
    },
    onUpdate: ({ editor: ed }) => {
      scheduleSave(ed.getHTML());
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      flush: async () => {
        const hadPending = pendingHtml.current !== null;
        cancelTimer();
        if (!editor) return;
        const html = editor.getHTML();
        if (!hadPending && html === lastSavedHtml.current) return;
        await runSave(html);
      },
    }),
    [editor, cancelTimer, runSave],
  );

  useEffect(() => {
    return () => {
      // Flush (don't drop) an edit still waiting on the debounce when the editor unmounts.
      const html = pendingHtml.current;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      pendingHtml.current = null;
      if (html !== null) runSave(html).catch(reportSaveError);
    };
  }, [runSave]);

  useEffect(() => {
    if (!editor) return;
    const onBlur = () => {
      const hadPending = pendingHtml.current !== null;
      cancelTimer();
      const html = editor.getHTML();
      if (!hadPending && html === lastSavedHtml.current) return;
      runSave(html).catch(reportSaveError);
    };
    editor.on("blur", onBlur);
    return () => {
      editor.off("blur", onBlur);
    };
  }, [editor, cancelTimer, runSave]);

  useEffect(() => {
    if (!editor) return;
    // Never clobber local typing: skip while focused or while a save is pending / in flight.
    if (editor.isFocused || pendingHtml.current !== null || inFlight.current > 0) return;
    const next = sanitizeHtml(initialHtml);
    // Our own save echoing back from the server.
    if (initialHtml === lastSavedHtml.current || next === lastSavedHtml.current) return;
    if (next !== editor.getHTML()) editor.commands.setContent(next, { emitUpdate: false });
    lastSavedHtml.current = next;
  }, [initialHtml, editor]);

  const insertImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/gif,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !editor) return;
      const r = await apiUploadFile(file);
      if (!r.success) {
        useUIStore.getState().showToast(r.error || "Could not upload the image", "error");
        return;
      }
      const u = r.data.url;
      const src = u.startsWith("http") ? u : `${apiBaseUrl()}${u.startsWith("/") ? u : `/${u}`}`;
      editor.chain().focus().setImage({ src }).run();
    };
    input.click();
  };

  if (!editor) {
    return <div className="min-h-[200px] rounded-xl border border-[var(--border)] bg-[var(--card)]" />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] bg-white/[0.03] px-3 py-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={toolbarBtn(editor.isActive("bold"))}
          aria-label="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={toolbarBtn(editor.isActive("italic"))}
          aria-label="Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={toolbarBtn(editor.isActive("heading", { level: 1 }))}
          aria-label="Heading 1"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={toolbarBtn(editor.isActive("heading", { level: 2 }))}
          aria-label="Heading 2"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={toolbarBtn(editor.isActive("heading", { level: 3 }))}
          aria-label="Heading 3"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={toolbarBtn(editor.isActive("bulletList"))}
          aria-label="Bullet list"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={toolbarBtn(editor.isActive("orderedList"))}
          aria-label="Numbered list"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={toolbarBtn(editor.isActive("taskList"))}
          aria-label="Task list"
        >
          <ListChecks className="w-3.5 h-3.5" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={toolbarBtn(editor.isActive("code"))}
          aria-label="Inline code"
        >
          <Code className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={toolbarBtn(editor.isActive("codeBlock"))}
          aria-label="Code block"
        >
          <span className="px-0.5 font-mono text-[10px] font-semibold">{"{}"}</span>
        </button>
        <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />
        <button
          type="button"
          onClick={() => {
            const prev = editor.getAttributes("link").href as string | undefined;
            const next = window.prompt("Link URL", prev ?? "https://");
            if (next === null) return;
            if (next === "") {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href: next }).run();
          }}
          className={toolbarBtn(editor.isActive("link"))}
          aria-label="Link"
        >
          <Link2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void insertImage()}
          className="issue-toolbar-icon"
          aria-label="Insert image"
        >
          <ImageIcon className="w-3.5 h-3.5" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />
        <button
          type="button"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          className="issue-toolbar-icon disabled:opacity-30"
          aria-label="Undo"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          className="issue-toolbar-icon disabled:opacity-30"
          aria-label="Redo"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-5 pt-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});
