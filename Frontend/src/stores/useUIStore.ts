import { create } from "zustand";
import type { Status, ToastState, TranscriptionCandidate } from "@/types/issue";

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
  /** Pre-selected status for the new issue (e.g. the board column it was opened from). */
  newIssueInitialStatus: Status | null;
  transcriptionSeedCandidates: TranscriptionCandidate[] | null;
  setProjectModalOpen: (v: boolean) => void;
  setExtractTasksModalOpen: (open: boolean, tab?: ExtractTasksModalTab) => void;
  openTranscriptionModalWithCandidates: (candidates: TranscriptionCandidate[]) => void;
  setInviteModalOpen: (v: boolean) => void;
  setFilterOpen: (v: boolean) => void;
  openNewIssueModal: (
    projectSlug?: string | null,
    initialStatus?: Status | null,
  ) => void;
  closeNewIssueModal: () => void;
  showToast: (message: string, type?: ToastState["type"]) => void;
  clearToast: () => void;
}

let toastSeq = 0;

export const useUIStore = create<UIState>((set) => ({
  isModalOpen: false,
  isProjectModalOpen: false,
  isExtractTasksModalOpen: false,
  extractTasksModalTab: "paste",
  isInviteModalOpen: false,
  isFilterOpen: false,
  toast: null,
  newIssueProjectSlug: null,
  newIssueInitialStatus: null,
  transcriptionSeedCandidates: null,
  setProjectModalOpen: (v) => set({ isProjectModalOpen: v }),
  setExtractTasksModalOpen: (open, tab = "paste") =>
    open
      ? set({ isExtractTasksModalOpen: true, extractTasksModalTab: tab })
      : // Drop any consumed transcription seed so it is not shown again on the next open.
        set({ isExtractTasksModalOpen: false, transcriptionSeedCandidates: null }),
  openTranscriptionModalWithCandidates: (candidates) =>
    set({
      transcriptionSeedCandidates: candidates,
      isExtractTasksModalOpen: true,
      extractTasksModalTab: "paste",
    }),
  setInviteModalOpen: (v) => set({ isInviteModalOpen: v }),
  setFilterOpen: (v) => set({ isFilterOpen: v }),
  openNewIssueModal: (projectSlug = null, initialStatus = null) =>
    set({
      isModalOpen: true,
      newIssueProjectSlug: projectSlug ?? null,
      newIssueInitialStatus: initialStatus ?? null,
    }),
  closeNewIssueModal: () =>
    set({
      isModalOpen: false,
      newIssueProjectSlug: null,
      newIssueInitialStatus: null,
    }),
  showToast: (message, type = "success") =>
    set({ toast: { id: ++toastSeq, message, type } }),
  clearToast: () => set({ toast: null }),
}));
