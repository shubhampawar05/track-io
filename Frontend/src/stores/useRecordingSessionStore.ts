import { create } from "zustand";
import { apiJson, apiUploadRecording } from "@/lib/api-client";
import type { RecordingUploadResult, TranscriptionCandidate } from "@/types/issue";
import { useUIStore } from "@/stores/useUIStore";

export type RecordingSessionPhase = "idle" | "capturing" | "stopped" | "uploading";

type Internal = {
  stream: MediaStream | null;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  timerId: number | null;
  startedAtMs: number | null;
  mimeType: string;
  ignoreNextStop: boolean;
};

const internal: Internal = {
  stream: null,
  recorder: null,
  chunks: [],
  timerId: null,
  startedAtMs: null,
  mimeType: "audio/webm",
  ignoreNextStop: false,
};

function clearTimer() {
  if (internal.timerId != null) {
    window.clearInterval(internal.timerId);
    internal.timerId = null;
  }
}

function stopMediaTracks() {
  internal.stream?.getTracks().forEach((track) => track.stop());
  internal.stream = null;
}

interface RecordingSessionState {
  phase: RecordingSessionPhase;
  durationMs: number;
  isPaused: boolean;
  audioBlob: Blob | null;
  startRecording: () => Promise<void>;
  pauseOrResume: () => void;
  stopRecording: () => void;
  discardSession: () => void;
  uploadAndExtract: () => Promise<void>;
  tickDuration: () => void;
}

export const useRecordingSessionStore = create<RecordingSessionState>((set, get) => ({
  phase: "idle",
  durationMs: 0,
  isPaused: false,
  audioBlob: null,

  tickDuration: () => {
    if (get().phase !== "capturing" || internal.startedAtMs == null) return;
    set({ durationMs: Date.now() - internal.startedAtMs });
  },

  startRecording: async () => {
    const showToast = useUIStore.getState().showToast;
    if (get().phase === "capturing" || get().phase === "uploading") return;
    if (get().phase === "stopped" && get().audioBlob) {
      showToast("Stop and extract or discard the current clip first", "error");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Microphone recording is not supported in this browser", "error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      internal.stream = stream;
      internal.chunks = [];
      const recorder = new MediaRecorder(stream);
      internal.recorder = recorder;
      internal.mimeType = recorder.mimeType || "audio/webm";
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) internal.chunks.push(event.data);
      };
      recorder.onstop = () => {
        clearTimer();
        internal.recorder = null;
        stopMediaTracks();
        internal.startedAtMs = null;
        if (internal.ignoreNextStop) {
          internal.ignoreNextStop = false;
          internal.chunks = [];
          set({
            phase: "idle",
            durationMs: 0,
            isPaused: false,
            audioBlob: null,
          });
          return;
        }
        const blob = new Blob(internal.chunks, { type: internal.mimeType || "audio/webm" });
        internal.chunks = [];
        set({
          phase: "stopped",
          isPaused: false,
          audioBlob: blob,
        });
      };
      internal.startedAtMs = Date.now();
      set({
        phase: "capturing",
        durationMs: 0,
        isPaused: false,
        audioBlob: null,
      });
      clearTimer();
      internal.timerId = window.setInterval(() => {
        get().tickDuration();
      }, 250);
      recorder.start();
    } catch {
      showToast("Could not access microphone", "error");
      get().discardSession();
    }
  },

  pauseOrResume: () => {
    const recorder = internal.recorder;
    if (!recorder || get().phase !== "capturing") return;
    if (recorder.state === "recording") {
      recorder.pause();
      set({ isPaused: true });
    } else if (recorder.state === "paused") {
      recorder.resume();
      set({ isPaused: false });
    }
  },

  stopRecording: () => {
    const recorder = internal.recorder;
    if (!recorder || get().phase !== "capturing") return;
    if (recorder.state !== "inactive") recorder.stop();
    clearTimer();
    internal.startedAtMs = null;
  },

  discardSession: () => {
    if (get().phase === "uploading") {
      return;
    }
    const recorder = internal.recorder;
    if (recorder && recorder.state !== "inactive") {
      internal.ignoreNextStop = true;
      try {
        recorder.stop();
      } catch {
        internal.ignoreNextStop = false;
        clearTimer();
        internal.recorder = null;
        internal.chunks = [];
        internal.startedAtMs = null;
        stopMediaTracks();
        set({
          phase: "idle",
          durationMs: 0,
          isPaused: false,
          audioBlob: null,
        });
      }
      return;
    }
    clearTimer();
    internal.recorder = null;
    internal.chunks = [];
    internal.startedAtMs = null;
    stopMediaTracks();
    set({
      phase: "idle",
      durationMs: 0,
      isPaused: false,
      audioBlob: null,
    });
  },

  uploadAndExtract: async () => {
    const showToast = useUIStore.getState().showToast;
    const openTranscriptionModalWithCandidates = useUIStore.getState().openTranscriptionModalWithCandidates;
    const { audioBlob, durationMs, phase } = get();
    if (!audioBlob || phase !== "stopped") {
      showToast("Record audio first", "error");
      return;
    }
    set({ phase: "uploading" });
    try {
      const ext = audioBlob.type.includes("mp4") ? "m4a" : "webm";
      const file = new File([audioBlob], `recording.${ext}`, { type: audioBlob.type || "audio/webm" });
      const upload = await apiUploadRecording<RecordingUploadResult>(file, durationMs);
      if (!upload.success) {
        showToast(upload.error, "error");
        set({ phase: "stopped" });
        return;
      }
      const transcribe = await apiJson<{ id: string; status: string; transcriptText: string }>(
        `/api/transcriptions/recordings/${encodeURIComponent(upload.data.id)}/transcribe`,
        { method: "POST" },
      );
      if (!transcribe.success) {
        showToast(transcribe.error, "error");
        set({ phase: "stopped" });
        return;
      }
      const candidatesRes = await apiJson<{ candidates: TranscriptionCandidate[] }>(
        `/api/transcriptions/recordings/${encodeURIComponent(upload.data.id)}/candidates`,
        { method: "POST" },
      );
      if (!candidatesRes.success) {
        showToast(candidatesRes.error, "error");
        set({ phase: "stopped" });
        return;
      }
      if (candidatesRes.data.candidates.length === 0) {
        showToast("No actionable tasks found from recording", "error");
        set({ phase: "stopped" });
        return;
      }
      openTranscriptionModalWithCandidates(candidatesRes.data.candidates);
      showToast("Candidates extracted from recording");
      clearTimer();
      internal.recorder = null;
      internal.chunks = [];
      internal.startedAtMs = null;
      stopMediaTracks();
      set({
        phase: "idle",
        durationMs: 0,
        isPaused: false,
        audioBlob: null,
      });
    } catch {
      showToast("Failed to process recording", "error");
      set({ phase: "stopped" });
    }
  },
}));
