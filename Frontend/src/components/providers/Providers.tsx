"use client";

import { AnimatePresence } from "motion/react";
import { ThemeProvider } from "next-themes";
import { Toast } from "@/components/modals/Toast";
import { AuthHydrator } from "@/components/providers/AuthHydrator";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { useUIStore } from "@/stores/useUIStore";

function AppToastHost() {
  const toast = useUIStore((s) => s.toast);
  const clearToast = useUIStore((s) => s.clearToast);
  return (
    <AnimatePresence>
      {toast && (
        <Toast
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={clearToast}
        />
      )}
    </AnimatePresence>
  );
}

export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <QueryProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        nonce={nonce}
      >
        <AuthHydrator />
        {children}
        <AppToastHost />
      </ThemeProvider>
    </QueryProvider>
  );
}
