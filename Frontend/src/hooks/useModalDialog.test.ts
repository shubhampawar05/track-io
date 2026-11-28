// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { focusableElements, focusOrigin, trapTabKey } from "./useModalDialog";

describe("focusOrigin", () => {
  it("returns the element focused before an autoFocus field inside the dialog", () => {
    document.body.innerHTML = `<button id="opener">open</button><div id="dlg"><input id="auto" /></div>`;
    document.getElementById("opener")!.focus();
    document.getElementById("auto")!.focus(); // what autoFocus does on mount
    expect(focusOrigin(document.getElementById("dlg"))?.id).toBe("opener");
  });

  it("returns the currently focused element when focus is still outside", () => {
    document.body.innerHTML = `<button id="opener">open</button><div id="dlg"><input /></div>`;
    document.getElementById("opener")!.focus();
    expect(focusOrigin(document.getElementById("dlg"))?.id).toBe("opener");
  });
});

function tab(shiftKey = false) {
  return new KeyboardEvent("keydown", { key: "Tab", shiftKey, cancelable: true });
}

describe("trapTabKey", () => {
  let dialog: HTMLElement;
  let outside: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="outside">outside</button>
      <div id="dialog">
        <input id="first" />
        <button id="disabled" disabled>x</button>
        <div hidden><button id="hidden">hidden</button></div>
        <button id="last">last</button>
      </div>`;
    dialog = document.getElementById("dialog")!;
    outside = document.getElementById("outside") as HTMLButtonElement;
  });

  it("skips disabled and hidden elements", () => {
    expect(focusableElements(dialog).map((e) => e.id)).toEqual(["first", "last"]);
  });

  it("wraps Tab from the last element to the first", () => {
    document.getElementById("last")!.focus();
    const e = tab();
    expect(trapTabKey(dialog, e)).toBe(true);
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe("first");
  });

  it("wraps Shift+Tab from the first element to the last", () => {
    document.getElementById("first")!.focus();
    expect(trapTabKey(dialog, tab(true))).toBe(true);
    expect(document.activeElement?.id).toBe("last");
  });

  it("lets Tab move normally between inner elements", () => {
    document.getElementById("first")!.focus();
    const e = tab();
    expect(trapTabKey(dialog, e)).toBe(false);
    expect(e.defaultPrevented).toBe(false);
  });

  it("pulls focus back in from <body>", () => {
    (document.activeElement as HTMLElement | null)?.blur();
    expect(trapTabKey(dialog, tab())).toBe(true);
    expect(document.activeElement?.id).toBe("first");
  });

  it("leaves focus alone in another layer (e.g. a portalled popover)", () => {
    outside.focus();
    const e = tab();
    expect(trapTabKey(dialog, e)).toBe(false);
    expect(document.activeElement).toBe(outside);
  });
});
