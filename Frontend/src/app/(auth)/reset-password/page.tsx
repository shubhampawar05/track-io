"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Key } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { AppLoadingSkeleton } from "@/components/layout/AppLoadingSkeleton";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!token) {
      setError("Missing reset token. Open the link from your email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const r = await apiJson<boolean>("/api/auth/reset-password", {
        method: "POST",
        body: { token, password },
      });
      if (!r.success) {
        setError(r.error);
        return;
      }
      setSuccess(true);
      redirectTimer.current = setTimeout(() => {
        router.replace("/");
      }, 2000);
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-(--bg)">
        <p className="text-sm text-linear-text-muted text-center max-w-md">
          Missing reset token. Use the link from your password reset email.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-(--bg) relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative z-10 w-full max-w-md space-y-8"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 bg-linear-accent rounded-xl flex items-center justify-center shadow-lg shadow-linear-accent/20">
            <Key className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
            <p className="text-sm text-linear-text-muted mt-2">Then sign in with your email and this password.</p>
          </div>
        </div>
        <div className="linear-card p-8 space-y-6">
          {success ? (
            <div className="space-y-3 text-center">
              <p className="text-sm font-medium text-(--text)">Your password was updated.</p>
              <p className="text-sm text-linear-text-muted">Taking you to sign in…</p>
            </div>
          ) : (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label
                  htmlFor="reset-new-password"
                  className="text-[10px] font-bold text-linear-text-muted uppercase tracking-widest"
                >
                  New password
                </label>
                <input
                  id="reset-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-(--border) rounded-md px-4 py-2 text-sm focus:outline-none focus:border-linear-accent transition-all duration-200"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="reset-confirm-password"
                  className="text-[10px] font-bold text-linear-text-muted uppercase tracking-widest"
                >
                  Confirm password
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full bg-white/5 border border-(--border) rounded-md px-4 py-2 text-sm focus:outline-none focus:border-linear-accent transition-all duration-200"
                />
              </div>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 bg-linear-accent hover:brightness-110 rounded-md font-semibold text-primary-foreground transition-all duration-200 disabled:opacity-50"
              >
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AppLoadingSkeleton />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
