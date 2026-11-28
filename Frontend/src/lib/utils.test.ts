import { describe, expect, it } from "vitest";
import { cn, safeDecodeURIComponent } from "@/lib/utils";

describe("safeDecodeURIComponent", () => {
  it("decodes a percent-encoded value", () => {
    expect(safeDecodeURIComponent("my%20project")).toBe("my project");
  });

  it("decodes only once", () => {
    expect(safeDecodeURIComponent("a%2520b")).toBe("a%20b");
  });

  it("returns plain values unchanged", () => {
    expect(safeDecodeURIComponent("TRK-12")).toBe("TRK-12");
  });

  it.each(["%", "100%", "%E0%A4%A"])("returns the raw value on URIError (%j)", (raw) => {
    expect(safeDecodeURIComponent(raw)).toBe(raw);
  });
});

describe("cn", () => {
  it("joins truthy class names and drops falsy ones", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("lets later tailwind classes win over conflicting earlier ones", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});
