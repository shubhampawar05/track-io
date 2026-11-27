"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Users } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { invalidateOrganizationScopedQueries } from "@/lib/invalidate-org-queries";
import { writeLastOrganizationId } from "@/lib/last-organization";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { AppLoadingSkeleton } from "@/components/layout/AppLoadingSkeleton";

function roleSentence(role: string): string {
  if (role === "admin") return "You will join as an admin.";
  return "You will join as a member.";
}

function AcceptInviteContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ organizationName: string; role: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewFailed, setPreviewFailed] = useState(false);

  const pathHere = `/accept-invite?token=${encodeURIComponent(token)}`;
  const loginHref = `/?next=${encodeURIComponent(pathHere)}`;
  const signupHref = `/signup?next=${encodeURIComponent(pathHere)}`;

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!token) {
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewFailed(false);
    void (async () => {
      const r = await apiJson<{ organizationName: string; role: string }>(
        `/api/auth/invite-preview?token=${encodeURIComponent(token)}`,
      );
      if (cancelled) return;
      setPreviewLoading(false);
      if (!r.success) {
        setPreviewFailed(true);
        return;
      }
      setPreview(r.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = async () => {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiJson<{ organizationId: string }>("/api/auth/accept-invite", {
        method: "POST",
        body: { token },
      });
      if (!r.success) {
        setError(r.error);
        return;
      }
      useOrganizationStore.getState().setOrganizationId(r.data.organizationId);
      if (user) writeLastOrganizationId(user.id, r.data.organizationId);
      await hydrate({ force: true });
      invalidateOrganizationScopedQueries(queryClient);
      router.replace("/issues/board");
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (!token || busy || !user) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiJson<true>("/api/auth/decline-invite", {
        method: "POST",
        body: { token },
      });
      if (!r.success) {
        setError(r.error);
        return;
      }
      invalidateOrganizationScopedQueries(queryClient);
      router.replace("/issues/board");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-(--bg)">
        <p className="text-sm text-linear-text-muted">Invalid invitation link.</p>
        <Link href="/" className="mt-4 text-sm text-linear-accent hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (previewLoading) {
    return <AppLoadingSkeleton />;
  }

  if (previewFailed || !preview) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-(--bg) text-center max-w-md mx-auto">
        <p className="text-sm text-linear-text-muted">
          This invitation is invalid or has expired. Ask your workspace admin for a new invite.
        </p>
        <Link href="/" className="mt-6 text-sm text-linear-accent hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-(--bg)">
        <p className="text-sm text-linear-text-muted">Checking your account…</p>
        <p className="text-sm text-(--text) mt-4 font-medium">{preview.organizationName}</p>
        <p className="text-xs text-linear-text-muted mt-1">{roleSentence(preview.role)}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-(--bg) relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md space-y-8 text-center"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-linear-accent rounded-xl flex items-center justify-center shadow-lg shadow-linear-accent/20">
              <Users className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">You&apos;re invited</h1>
              <p className="text-lg font-medium text-(--text) mt-3">{preview.organizationName}</p>
              <p className="text-xs text-linear-text-muted mt-1">{roleSentence(preview.role)}</p>
              <p className="text-sm text-linear-text-muted mt-4">
                Sign in or create an account using the <strong>same email</strong> the invitation was sent to.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={loginHref}
              className="inline-flex justify-center py-2.5 px-4 bg-linear-accent hover:brightness-110 rounded-md font-semibold text-primary-foreground text-sm transition-all"
            >
              Sign in
            </Link>
            <Link
              href={signupHref}
              className="inline-flex justify-center py-2.5 px-4 border border-(--border) rounded-md font-medium text-sm hover:bg-white/5 transition-colors"
            >
              Create account
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-(--bg) relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md space-y-8 text-center"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-linear-accent rounded-xl flex items-center justify-center shadow-lg shadow-linear-accent/20">
            <Users className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Join workspace</h1>
            <p className="text-lg font-medium text-(--text) mt-3">{preview.organizationName}</p>
            <p className="text-xs text-linear-text-muted mt-1">{roleSentence(preview.role)}</p>
            <p className="text-sm text-linear-text-muted mt-4">
              Signed in as <strong>{user.email}</strong>. Accept to add this workspace to your account.
            </p>
          </div>
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void accept()}
            className="w-full py-2.5 bg-linear-accent hover:brightness-110 rounded-md font-semibold text-primary-foreground text-sm transition-all disabled:opacity-50"
          >
            {busy ? "Joining…" : "Accept invitation"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void decline()}
            className="w-full py-2.5 border border-(--border) rounded-md font-medium text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {busy ? "Please wait…" : "Decline invitation"}
          </button>
          <Link href={loginHref} className="text-sm text-linear-accent hover:underline">
            Use a different account
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<AppLoadingSkeleton />}>
      <AcceptInviteContent />
    </Suspense>
  );
}
