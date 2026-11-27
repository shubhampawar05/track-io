import { create } from "zustand";
import type { ToastState, TranscriptionCandidate } from "@/types/issue";

export type ExtractTasksModalTab = "paste" | "record";

interface UIState {
  isModalOpen: boolean;
  isProjectModalOpen: boolean;
  isExtractTasksModalOpen: boolean;
  extractTasksModalTab: ExtractTasksModalTab;
  isInviteModalOpen: boolean;
  isFilterOpen: boolean;
  toast: ToastState | null;
  /** When creating an issue from a project workspace, scope to this project slug */
  newIssueProjectSlug: string | null;
  transcriptionSeedCandidates: TranscriptionCandidate[] | null;
  setModalOpen: (v: boolean) => void;
  setProjectModalOpen: (v: boolean) => void;
  setExtractTasksModalOpen: (open: boolean, tab?: ExtractTasksModalTab) => void;
  openTranscriptionModalWithCandidates: (candidates: TranscriptionCandidate[]) => void;
  clearTranscriptionSeedCandidates: () => void;
  setInviteModalOpen: (v: boolean) => void;
  setFilterOpen: (v: boolean) => void;
  setNewIssueProjectSlug: (slug: string | null) => void;
  openNewIssueModal: (projectSlug?: string | null) => void;
  closeNewIssueModal: () => void;
  showToast: (message: string, type?: ToastState["type"]) => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isModalOpen: false,
  isProjectModalOpen: false,
  isExtractTasksModalOpen: false,
  extractTasksModalTab: "paste",
  isInviteModalOpen: false,
  isFilterOpen: false,
  toast: null,
  newIssueProjectSlug: null,
  transcriptionSeedCandidates: null,
  setModalOpen: (v) => set({ isModalOpen: v }),
  setProjectModalOpen: (v) => set({ isProjectModalOpen: v }),
  setExtractTasksModalOpen: (open, tab = "paste") =>
    open
      ? set({ isExtractTasksModalOpen: true, extractTasksModalTab: tab })
      : set({ isExtractTasksModalOpen: false }),
  openTranscriptionModalWithCandidates: (candidates) =>
    set({
      transcriptionSeedCandidates: candidates,
      isExtractTasksModalOpen: true,
      extractTasksModalTab: "paste",
    }),
  clearTranscriptionSeedCandidates: () => set({ transcriptionSeedCandidates: null }),
  setInviteModalOpen: (v) => set({ isInviteModalOpen: v }),
  setFilterOpen: (v) => set({ isFilterOpen: v }),
  setNewIssueProjectSlug: (slug) => set({ newIssueProjectSlug: slug }),
  openNewIssueModal: (projectSlug = null) =>
    set({ isModalOpen: true, newIssueProjectSlug: projectSlug ?? null }),
  closeNewIssueModal: () => set({ isModalOpen: false, newIssueProjectSlug: null }),
  showToast: (message, type = "success") => set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),
}));
