"use client";

import { FilterPanelScrollContent } from "@/components/filters/FilterPanelScrollContent";

export function FilterPanelSections({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FilterPanelScrollContent isOpen={isOpen} onClose={onClose} />
    </div>
  );
}
