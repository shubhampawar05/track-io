"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_PREFIX = "trackio.prefs.";

type PrefKey = "autoSaveDrafts" | "compactView" | "keyboardShortcuts";

const DEFAULTS: Record<PrefKey, boolean> = {
  autoSaveDrafts: true,
  compactView: false,
  keyboardShortcuts: true,
};

const ROWS: { key: PrefKey; title: string; desc: string }[] = [
  {
    key: "autoSaveDrafts",
    title: "Auto-save drafts",
    desc: "Remember issue draft text in this browser (local only).",
  },
  {
    key: "compactView",
    title: "Compact view",
    desc: "Tighter spacing in lists (applies when supported).",
  },
  {
    key: "keyboardShortcuts",
    title: "Keyboard shortcuts",
    desc: "Enable navigation shortcuts (where implemented).",
  },
];

function readPref(key: PrefKey): boolean {
  if (typeof window === "undefined") return DEFAULTS[key];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (raw === null) return DEFAULTS[key];
    return raw === "1" || raw === "true";
  } catch {
    return DEFAULTS[key];
  }
}

const prefsStoreListeners = new Set<() => void>();

function subscribePrefs(onStoreChange: () => void) {
  prefsStoreListeners.add(onStoreChange);
  return () => {
    prefsStoreListeners.delete(onStoreChange);
  };
}

function emitPrefsChange() {
  prefsStoreListeners.forEach((listener) => listener());
}

let storageListenerAttached = false;
function ensureCrossTabPrefsListener() {
  if (typeof window === "undefined" || storageListenerAttached) return;
  storageListenerAttached = true;
  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key == null || event.key.startsWith(STORAGE_PREFIX)) {
      emitPrefsChange();
    }
  });
}

function writePref(key: PrefKey, value: boolean) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_PREFIX + key, value ? "1" : "0");
    emitPrefsChange();
  } catch {
    /* ignore */
  }
}

function usePref(key: PrefKey): boolean {
  return useSyncExternalStore(
    subscribePrefs,
    () => readPref(key),
    () => DEFAULTS[key],
  );
}

export function SettingsPreferencesTab() {
  ensureCrossTabPrefsListener();
  const prefs: Record<PrefKey, boolean> = {
    autoSaveDrafts: usePref("autoSaveDrafts"),
    compactView: usePref("compactView"),
    keyboardShortcuts: usePref("keyboardShortcuts"),
  };

  const toggle = useCallback((key: PrefKey) => {
    writePref(key, !readPref(key));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-semibold mb-2">Preferences</h3>
        <p className="text-sm text-linear-text-muted">
          Stored in this browser only (not synced to the server yet).
        </p>
      </div>
      <div className="space-y-6">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between p-4 linear-card gap-4">
            <div>
              <p className="text-sm font-medium">{row.title}</p>
              <p className="text-xs text-linear-text-muted">{row.desc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[row.key]}
              onClick={() => toggle(row.key)}
              className={`w-10 h-5 rounded-full relative shrink-0 transition-colors duration-200 ${
                prefs[row.key] ? "bg-linear-accent" : "bg-white/10"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                  prefs[row.key] ? "right-0.5" : "left-0.5"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
