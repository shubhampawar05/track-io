"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, Key, MessageSquare } from "lucide-react";

export function AuthResetPanel({
  onBack,
  onRequestReset,
  backLabel = "Back to sign in",
}: {
  onBack: () => void;
  onRequestReset: (email: string) => Promise<string | null>;
  backLabel?: string;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email address");
      return;
    }
    setBusy(true);
    try {
      const err = await onRequestReset(trimmed);
      if (err) {
        setError(err);
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg)] relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-linear-accent/10 blur-[120px] rounded-full" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative z-10 w-full max-w-md space-y-8 text-center"
      >
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 bg-linear-accent rounded-xl flex items-center justify-center shadow-lg shadow-linear-accent/20">
            <Key className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Reset your password</h2>
            <p className="text-sm text-linear-text-muted">
              We&apos;ll send a password reset link to your work email.
            </p>
          </div>
        </div>

        <div className="linear-card p-8 space-y-6 text-left">
          {done ? (
            <p className="text-sm text-linear-text-muted text-center">
              If an account exists for that email, we sent password reset instructions. You can close this tab or
              return to sign in.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-linear-text-muted uppercase tracking-widest">
                  Work Email
                </label>
                <div className="relative">
                  <MessageSquare className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-linear-text-muted" />
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-[var(--border)] rounded-md pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-linear-accent transition-all duration-200"
                  />
                </div>
              </div>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="w-full py-2.5 bg-linear-accent hover:brightness-110 rounded-md font-semibold text-primary-foreground transition-all duration-200 shadow-lg shadow-linear-accent/20 disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 text-sm text-linear-text-muted hover:text-[var(--text)] transition-colors duration-200"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            {backLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
