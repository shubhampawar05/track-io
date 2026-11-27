"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Users, X } from "lucide-react";

export function InviteMemberModal({
  isOpen,
  onClose,
  onInvite,
}: {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string) => Promise<string | null>;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setError(null);
      setBusy(false);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold text-linear-text-muted uppercase tracking-widest">
                <Users className="w-3 h-3" />
                INVITE TO WORKSPACE
              </div>
              <button type="button" onClick={onClose} className="text-linear-text-muted hover:text-[var(--text)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-linear-text-muted uppercase tracking-widest">
                  Email Address
                </label>
                <input
                  autoFocus
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="colleague@example.com"
                  className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-linear-accent transition-colors duration-200"
                />
              </div>
              <p className="text-xs text-linear-text-muted">
                They will receive an invitation email to join your workspace as a member.
              </p>
              {error ? <p className="text-xs text-red-400">{error}</p> : null}
            </div>
            <div className="p-4 bg-white/5 border-t border-[var(--border)] flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium hover:bg-white/5 rounded-md transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!email.trim() || busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      const err = await onInvite(email.trim());
                      if (err) {
                        setError(err);
                        return;
                      }
                      onClose();
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
                className="linear-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "Sending…" : "Send Invitation"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
