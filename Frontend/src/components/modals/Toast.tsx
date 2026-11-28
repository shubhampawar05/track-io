"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ToastType } from "@/types/issue";

export function Toast({
  id,
  message,
  type,
  onClose,
}: {
  id: number;
  message: string;
  type: ToastType;
  onClose: () => void;
}) {
  // Restart the countdown whenever a new toast replaces the current one.
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose, id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, x: "-50%" }}
      animate={{ opacity: 1, y: 0, x: "-50%" }}
      exit={{ opacity: 0, y: 50, x: "-50%" }}
      transition={{ duration: 0.2 }}
      role="status"
      aria-live="polite"
      className={`fixed bottom-8 left-1/2 z-[100] px-6 py-3 rounded-lg shadow-2xl border flex items-center gap-3 min-w-[300px] transition-colors duration-200 ${
        type === "success"
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
          : "bg-red-500/10 border-red-500/20 text-red-500"
      }`}
    >
      {type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
      <span className="text-sm font-medium">{message}</span>
    </motion.div>
  );
}
