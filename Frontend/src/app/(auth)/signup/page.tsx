"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthView } from "@/components/auth/AuthView";
import { apiJson } from "@/lib/api-client";
import { safeInternalPath } from "@/lib/safe-next";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUIStore } from "@/stores/useUIStore";
import { AppLoadingSkeleton } from "@/components/layout/AppLoadingSkeleton";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const showToast = useUIStore((s) => s.showToast);
  const next = safeInternalPath(searchParams.get("next"));
  const nextQs = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <AuthView
      variant="signupOnly"
      loginHref={`/${nextQs}`}
      onRequestPasswordReset={async (email) => {
        const r = await apiJson<{ message: string }>("/api/auth/forgot-password", {
          method: "POST",
          body: { email },
        });
        if (!r.success) return r.error;
        return null;
      }}
      onLogin={async (email, password) => {
        try {
          const err = await login(email, password);
          if (err) {
            showToast(err, "error");
            return;
          }
          showToast("Welcome back!");
          router.push(next ?? "/issues/board");
        } catch {
          showToast("Something went wrong. Please try again.", "error");
        }
      }}
      onSignup={async (name, email, password) => {
        try {
          const err = await register(name, email, password);
          if (err) {
            showToast(err, "error");
            return;
          }
          showToast("Account created!");
          router.push(next ?? "/onboarding");
        } catch {
          showToast("Something went wrong. Please try again.", "error");
        }
      }}
    />
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AppLoadingSkeleton />}>
      <SignupContent />
    </Suspense>
  );
}
