"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLoadingSkeleton } from "@/components/layout/AppLoadingSkeleton";

function LoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `/?${qs}` : "/");
  }, [router, searchParams]);

  return <AppLoadingSkeleton />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AppLoadingSkeleton />}>
      <LoginRedirect />
    </Suspense>
  );
}
