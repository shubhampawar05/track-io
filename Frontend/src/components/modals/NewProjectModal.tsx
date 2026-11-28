"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Layers, X } from "lucide-react";
import { useModalDialog } from "@/hooks/useModalDialog";

export function NewProjectModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Resolves `true` on success; on `false` the modal stays open with the form intact. */
  onAdd: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  // Escape is handled on the form below (it must respect `busy`).
  const dialogRef = useModalDialog<HTMLFormElement>(isOpen, null);

  /** Closing is ignored mid-request (the project would still be created) and clears the form. */
  const close = () => {
    if (busy) return;
    setName("");
    onClose();
  };

  const submit = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      if (!(await onAdd(name.trim()))) return;
      setName("");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.form
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
            }}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <div
                id="new-project-title"
                className="flex items-center gap-2 text-[10px] font-bold text-linear-text-muted uppercase tracking-widest"
              >
                <Layers className="w-3 h-3" aria-hidden />
                NEW PROJECT
              </div>
              <button type="button" onClick={close} aria-label="Close" className="text-linear-text-muted hover:text-[var(--text)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl font-bold`}
                  >
                    {name ? name.charAt(0).toUpperCase() : "P"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      autoFocus
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Project name"
                      aria-label="Project name"
                      className="w-full bg-transparent text-xl font-bold focus:outline-none placeholder:text-linear-text-muted/30"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white/5 border-t border-[var(--border)] flex justify-end gap-3">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 text-sm font-medium hover:bg-white/5 rounded-md transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || busy}
                className="linear-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Project
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}
