"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Users, X } from "lucide-react";
import { useModalDialog } from "@/hooks/useModalDialog";

export type InviteRole = "member" | "admin";

type InviteMemberModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: InviteRole) => Promise<string | null>;
};

/** Form state lives in the content component, mounted only while open, so it resets on close. */
export function InviteMemberModal({ isOpen, ...props }: InviteMemberModalProps) {
  return (
    <AnimatePresence>
      {isOpen && <InviteMemberModalContent key="invite-member" {...props} />}
    </AnimatePresence>
  );
}

function InviteMemberModalContent({
  onClose,
  onInvite,
}: Omit<InviteMemberModalProps, "isOpen">) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailId = useId();
  const roleId = useId();
  const titleId = useId();
  // Mounted only while open; Escape closes unless an invitation is being sent.
  const dialogRef = useModalDialog<HTMLFormElement>(true, busy ? null : onClose);

  const submit = async () => {
    if (busy || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const err = await onInvite(email.trim(), role);
      if (err) {
        setError(err);
        return;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div
            id={titleId}
            className="flex items-center gap-2 text-[10px] font-bold text-linear-text-muted uppercase tracking-widest"
          >
            <Users className="w-3 h-3" aria-hidden />
            INVITE TO WORKSPACE
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-linear-text-muted hover:text-[var(--text)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label
              htmlFor={emailId}
              className="text-xs font-bold text-linear-text-muted uppercase tracking-widest"
            >
              Email Address
            </label>
            <input
              id={emailId}
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
          <div className="space-y-2">
            <label
              htmlFor={roleId}
              className="text-xs font-bold text-linear-text-muted uppercase tracking-widest"
            >
              Role
            </label>
            <select
              id={roleId}
              value={role}
              onChange={(e) => setRole(e.target.value as InviteRole)}
              className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-linear-accent transition-colors duration-200"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <p className="text-xs text-linear-text-muted">
            They will receive an invitation email to join your workspace as{" "}
            {role === "admin" ? "an admin" : "a member"}.
          </p>
          {error ? (
            <p role="alert" className="text-xs text-red-400">
              {error}
            </p>
          ) : null}
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
            type="submit"
            disabled={!email.trim() || busy}
            className="linear-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Sending…" : "Send Invitation"}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
