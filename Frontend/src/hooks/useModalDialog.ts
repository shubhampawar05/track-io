import { useEffect, useLayoutEffect, useRef } from "react";

const FOCUSABLE = [
  "input:not([disabled]):not([type=hidden])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "button:not([disabled])",
  "a[href]",
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** Keyboard-reachable elements inside `container`, in DOM order (skips hidden ones). */
export function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest("[hidden], [inert], [aria-hidden='true']"),
  );
}

/**
 * Keeps Tab / Shift+Tab cycling inside `container`. Focus that is in some other layer (e.g. a
 * select or popover portalled to <body>) is left alone so those widgets keep working.
 * Returns true when it moved focus.
 */
export function trapTabKey(container: HTMLElement, e: KeyboardEvent): boolean {
  if (e.key !== "Tab") return false;
  const active = document.activeElement;
  const inside = active instanceof Node && container.contains(active);
  if (!inside && active !== document.body && active !== null) return false;
  const items = focusableElements(container);
  if (items.length === 0) {
    e.preventDefault();
    container.focus();
    return true;
  }
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (!inside || (e.shiftKey && active === first) || (!e.shiftKey && active === last)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
    return true;
  }
  return false;
}

/**
 * The two most recently focused elements, tracked globally. A dialog's `autoFocus` field
 * takes focus during React's commit, before effects run, so "what had focus before the dialog
 * opened" is the element focused just before that one.
 */
let focusedBefore: HTMLElement | null = null;
let focusedNow: HTMLElement | null = null;
let focusTrackingInstalled = false;

function installFocusTracking() {
  if (focusTrackingInstalled || typeof document === "undefined") return;
  focusTrackingInstalled = true;
  focusedNow = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.addEventListener(
    "focusin",
    (e) => {
      if (!(e.target instanceof HTMLElement) || e.target === focusedNow) return;
      focusedBefore = focusedNow;
      focusedNow = e.target;
    },
    true,
  );
}

/** Element to return focus to when a dialog rendered in `container` closes. */
export function focusOrigin(container: HTMLElement | null): HTMLElement | null {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (container && active && container.contains(active)) {
    return focusedBefore && !container.contains(focusedBefore) ? focusedBefore : null;
  }
  return active;
}

if (typeof document !== "undefined") installFocusTracking();

/**
 * Modal behaviour for hand-rolled dialogs. While `open`:
 * - focus moves into the returned container ref (unless something inside already has it,
 *   e.g. an `autoFocus` field), and Tab / Shift+Tab stay inside it;
 * - Escape calls `onClose` (pass `null` when the dialog handles Escape itself), unless a
 *   nested widget such as an open select already handled it;
 * - on close, focus returns to the element that had it before the dialog opened.
 */
export function useModalDialog<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: (() => void) | null,
) {
  const containerRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    const previouslyFocused = focusOrigin(container);
    if (container && !container.contains(document.activeElement)) {
      const target = focusableElements(container)[0] ?? container;
      if (target === container && !container.hasAttribute("tabindex")) {
        container.setAttribute("tabindex", "-1");
      }
      target.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      const node = containerRef.current;
      if (e.key === "Tab" && node) {
        trapTabKey(node, e);
        return;
      }
      if (e.key !== "Escape" || e.defaultPrevented || !onCloseRef.current) return;
      e.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  return containerRef;
}
