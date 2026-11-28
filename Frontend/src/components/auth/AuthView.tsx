"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Layers } from "lucide-react";
import { AuthResetPanel } from "@/components/auth/AuthResetPanel";

export function AuthView({
  variant,
  signupHref = "/signup",
  loginHref = "/",
  onLogin,
  onSignup,
  onRequestPasswordReset,
}: {
  variant: "loginOnly" | "signupOnly";
  signupHref?: string;
  loginHref?: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (name: string, email: string, password: string) => Promise<void>;
  onRequestPasswordReset: (email: string) => Promise<string | null>;
}) {
  const formMode = variant === "signupOnly" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup" | "reset">(formMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();

  if (mode === "reset") {
    const backLabel =
      variant === "signupOnly" ? "Back to sign up" : "Back to sign in";
    return (
      <AuthResetPanel
        onBack={() => setMode(formMode)}
        onRequestReset={onRequestPasswordReset}
        backLabel={backLabel}
      />
    );
  }

  const submit = async () => {
    if (busy) return;
    if (mode === "signup" && password.length < 8) return;
    setBusy(true);
    try {
      if (mode === "login") await onLogin(email.trim(), password);
      else await onSignup(name.trim(), email.trim(), password);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)] relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-linear-accent/10 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative z-10 w-full max-w-md space-y-8 text-center"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-linear-accent rounded-xl flex items-center justify-center shadow-lg shadow-linear-accent/20">
            <Layers className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-[var(--text)] mb-2">Trackio</p>
            <h2 className="text-3xl font-bold tracking-tight">
              {mode === "login"
                ? "Sign in to your workspace"
                : "Create your account"}
            </h2>
            <p className="text-linear-text-muted mt-2">
              {mode === "login"
                ? "Sign in with the account you registered, or create a new workspace."
                : "Start building your next engineering project today."}
            </p>
          </div>
        </div>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="linear-card p-8 space-y-6 text-left"
        >
          {mode === "signup" && (
            <div className="space-y-2">
              <label
                htmlFor={nameId}
                className="text-[10px] font-bold text-linear-text-muted uppercase tracking-widest"
              >
                Full Name
              </label>
              <input
                id={nameId}
                type="text"
                autoComplete="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-[var(--border)] rounded-md px-4 py-2 text-sm focus:outline-none focus:border-linear-accent transition-all duration-200"
              />
            </div>
          )}
          <div className="space-y-2">
            <label
              htmlFor={emailId}
              className="text-[10px] font-bold text-linear-text-muted uppercase tracking-widest"
            >
              Work Email
            </label>
            <input
              id={emailId}
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-[var(--border)] rounded-md px-4 py-2 text-sm focus:outline-none focus:border-linear-accent transition-all duration-200"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center gap-2 min-h-[1.25rem]">
              <label
                htmlFor={passwordId}
                className="text-[10px] font-bold text-linear-text-muted uppercase tracking-widest"
              >
                Password
              </label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => setMode("reset")}
                  className="shrink-0 text-xs font-medium text-linear-accent hover:underline py-1 px-0.5 -mr-0.5 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent/40"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              id={passwordId}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-[var(--border)] rounded-md px-4 py-2 text-sm focus:outline-none focus:border-linear-accent transition-all duration-200"
            />
            {mode === "signup" && password.length > 0 && password.length < 8 ? (
              <p className="text-xs text-red-400">Password must be at least 8 characters.</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 bg-linear-accent hover:brightness-110 rounded-md font-semibold transition-all duration-200 shadow-lg shadow-linear-accent/20 text-primary-foreground disabled:opacity-50"
          >
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        {variant === "loginOnly" ? (
          <p className="text-sm text-linear-text-muted">
            Don&apos;t have an account?{" "}
            <Link
              href={signupHref}
              className="text-linear-accent hover:underline"
            >
              Sign up
            </Link>
          </p>
        ) : (
          <p className="text-sm text-linear-text-muted">
            Already have an account?{" "}
            <Link
              href={loginHref}
              className="text-linear-accent hover:underline"
            >
              Sign in
            </Link>
          </p>
        )}
      </motion.div>
    </div>
  );
}
