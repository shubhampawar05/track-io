"use client";

import { AnimatePresence, motion } from "motion/react";
import { FilterPanelSections } from "@/components/filters/FilterPanelSections";

export function FilterPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative flex h-full w-[280px] flex-col border-l border-border bg-card p-5 shadow-2xl"
          >
            <FilterPanelSections isOpen={isOpen} onClose={onClose} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
