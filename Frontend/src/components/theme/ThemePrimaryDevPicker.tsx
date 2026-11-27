"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Check, Palette } from "lucide-react";

const STORAGE_KEY = "theme-primary-color";

type SolidId =
  | "linear-indigo"
  | "violet-aims"
  | "electric-blue"
  | "cyan"
  | "emerald"
  | "rose"
  | "amber"
  | "slate";

type GradientId =
  | "cosmic"
  | "aurora"
  | "ember"
  | "forest"
  | "candy"
  | "midnight";

type ThemeSelection =
  | { kind: "solid"; id: SolidId; primary: string }
  | { kind: "gradient"; id: GradientId; primary: string; gradient: string };

const SOLID_OPTIONS: { id: SolidId; label: string; hex: string }[] = [
  { id: "linear-indigo", label: "Linear Indigo", hex: "#5e6ad2" },
  { id: "violet-aims", label: "Violet (AIMS)", hex: "#755FF8" },
  { id: "electric-blue", label: "Electric Blue", hex: "#3b82f6" },
  { id: "cyan", label: "Cyan", hex: "#06b6d4" },
  { id: "emerald", label: "Emerald", hex: "#10b981" },
  { id: "rose", label: "Rose", hex: "#f43f5e" },
  { id: "amber", label: "Amber", hex: "#f59e0b" },
  { id: "slate", label: "Slate", hex: "#64748b" },
];

const GRADIENT_OPTIONS: {
  id: GradientId;
  label: string;
  from: string;
  to: string;
}[] = [
  { id: "cosmic", label: "Cosmic", from: "#7c3aed", to: "#5e6ad2" },
  { id: "aurora", label: "Aurora", from: "#06b6d4", to: "#3b82f6" },
  { id: "ember", label: "Ember", from: "#f43f5e", to: "#f59e0b" },
  { id: "forest", label: "Forest", from: "#10b981", to: "#3b82f6" },
  { id: "candy", label: "Candy", from: "#ec4899", to: "#8b5cf6" },
  { id: "midnight", label: "Midnight", from: "#1e40af", to: "#5e6ad2" },
];

const DEFAULT_SELECTION: ThemeSelection = {
  kind: "gradient",
  id: "forest",
  primary: "#3b82f6",
  gradient: "linear-gradient(90deg, #10b981, #3b82f6)",
};

function gradientCss(from: string, to: string): string {
  return `linear-gradient(90deg, ${from}, ${to})`;
}

function parseStored(raw: string | null): ThemeSelection | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    if (
      o.kind === "solid" &&
      typeof o.primary === "string" &&
      typeof o.id === "string"
    ) {
      return { kind: "solid", id: o.id as SolidId, primary: o.primary };
    }
    if (
      o.kind === "gradient" &&
      typeof o.primary === "string" &&
      typeof o.gradient === "string" &&
      typeof o.id === "string"
    ) {
      return {
        kind: "gradient",
        id: o.id as GradientId,
        primary: o.primary,
        gradient: o.gradient,
      };
    }
  } catch {
    return null;
  }
  return null;
}

function applyToDocument(selection: ThemeSelection) {
  const root = document.documentElement;
  root.style.setProperty("--primary", selection.primary);
  if (selection.kind === "gradient") {
    root.style.setProperty("--primary-gradient", selection.gradient);
    /* Inline on <html> survives React root reconciliation; used for active nav contrast. */
    root.style.setProperty("--sidebar-active-fg", "#ffffff");
  } else {
    root.style.removeProperty("--primary-gradient");
    root.style.removeProperty("--sidebar-active-fg");
  }
}

let themePickerHydrated = false;
const themePickerListeners = new Set<() => void>();
let themePickerCachedJson: string | null | undefined;
let themePickerCachedSelection: ThemeSelection = DEFAULT_SELECTION;

function subscribeThemePicker(onStoreChange: () => void) {
  themePickerListeners.add(onStoreChange);
  return () => {
    themePickerListeners.delete(onStoreChange);
  };
}

function notifyThemePicker() {
  themePickerListeners.forEach((cb) => {
    cb();
  });
}

function getThemePickerSnapshot(): ThemeSelection {
  if (typeof window === "undefined") return DEFAULT_SELECTION;
  if (!themePickerHydrated) return DEFAULT_SELECTION;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === themePickerCachedJson) return themePickerCachedSelection;
  themePickerCachedJson = raw;
  themePickerCachedSelection = parseStored(raw) ?? DEFAULT_SELECTION;
  return themePickerCachedSelection;
}

export function ThemePrimaryDevPicker() {
  const [open, setOpen] = useState(false);
  const active = useSyncExternalStore(
    subscribeThemePicker,
    getThemePickerSnapshot,
    () => DEFAULT_SELECTION,
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (!themePickerHydrated) {
      themePickerHydrated = true;
      const raw = localStorage.getItem(STORAGE_KEY);
      themePickerCachedJson = raw;
      themePickerCachedSelection = parseStored(raw) ?? DEFAULT_SELECTION;
      applyToDocument(themePickerCachedSelection);
      notifyThemePicker();
      return;
    }
    applyToDocument(active);
  }, [active]);

  const persist = useCallback((selection: ThemeSelection) => {
    const json = JSON.stringify(selection);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      /* ignore quota */
    }
    themePickerCachedJson = json;
    themePickerCachedSelection = selection;
    applyToDocument(selection);
    notifyThemePicker();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t))
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const swatchPreview =
    active.kind === "gradient"
      ? {
          backgroundImage: active.gradient,
          backgroundColor: "transparent" as const,
        }
      : { backgroundColor: active.primary };

  return (
    <div className="relative shrink-0">
      {open && (
        <div
          ref={panelRef}
          className="absolute top-full right-0 z-50 mt-1.5 w-[280px] rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1c1c28] p-4 shadow-xl"
          role="dialog"
          aria-label="Theme primary color"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] mb-2">
            Solid
          </p>
          <div className="grid grid-cols-4 gap-3 mb-5">
            {SOLID_OPTIONS.map((opt) => {
              const isActive = active.kind === "solid" && active.id === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.label}
                  onClick={() =>
                    persist({ kind: "solid", id: opt.id, primary: opt.hex })
                  }
                  className="relative h-8 w-8 rounded-full border border-[rgba(255,255,255,0.12)] shadow-sm transition-transform duration-150 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--primary)"
                  style={{ backgroundColor: opt.hex }}
                >
                  {isActive && (
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35">
                      <Check
                        className="h-3.5 w-3.5 text-white drop-shadow"
                        strokeWidth={2.5}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] mb-2">
            Gradient
          </p>
          <div className="flex flex-col gap-2 mb-3">
            {GRADIENT_OPTIONS.map((opt) => {
              const gradient = gradientCss(opt.from, opt.to);
              const isActive =
                active.kind === "gradient" && active.id === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.label}
                  onClick={() =>
                    persist({
                      kind: "gradient",
                      id: opt.id,
                      primary: opt.to,
                      gradient,
                    })
                  }
                  className="relative h-7 w-full rounded-full border border-[rgba(255,255,255,0.08)] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-(--primary) transition-opacity duration-150 hover:opacity-95"
                  style={{ backgroundImage: gradient }}
                >
                  <span className="sr-only">{opt.label}</span>
                  {isActive && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-black/45">
                      <Check className="h-3 w-3 text-white" strokeWidth={2.5} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] leading-snug text-[#4b5563]">
            Changes are visual only — export your chosen hex to apply
            permanently
          </p>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-(--border) bg-white/5 cursor-pointer transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--primary)"
        aria-expanded={open}
        aria-label="Open theme color picker"
        title="Theme Color"
      >
        <span aria-hidden className="absolute inset-0" style={swatchPreview} />
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-(--hover) opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        />
        <Palette
          className="relative h-[18px] w-[18px] text-white drop-shadow-md"
          strokeWidth={2}
        />
      </button>
    </div>
  );
}
