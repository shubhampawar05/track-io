import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/safe-next";

describe("safeInternalPath", () => {
  it.each([
    ["/issues/board", "/issues/board"],
    ["/accept-invite?token=abc", "/accept-invite?token=abc"],
    ["/p?a=1#x", "/p?a=1#x"],
    ["/", "/"],
  ])("accepts same-origin path %s", (input, expected) => {
    expect(safeInternalPath(input)).toBe(expected);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(safeInternalPath("  /issues/list  ")).toBe("/issues/list");
  });

  it("normalises dot segments without leaving the origin", () => {
    expect(safeInternalPath("/a/../b")).toBe("/b");
  });

  it.each([null, undefined, "", "   "])("rejects empty input %j", (input) => {
    expect(safeInternalPath(input)).toBeNull();
  });

  it.each([
    ["absolute URL", "https://evil.com"],
    ["protocol-relative URL", "//evil.com"],
    ["backslash after slash", "/\\evil.com"],
    ["encoded slash", "/%2F/evil.com"],
    ["encoded backslash", "/%5Cevil.com"],
    ["encoded tab", "/%09/evil.com"],
    ["literal tab", "/\t/evil.com"],
    ["inner space", "/foo bar"],
    ["newline", "/foo\nbar"],
    ["NUL control char", "/foo\u0000bar"],
    ["DEL control char", "/foo\u007fbar"],
    ["encoded newline", "/foo%0Abar"],
    ["javascript: scheme", "javascript:alert(1)"],
    ["relative path", "issues/board"],
    ["malformed percent-encoding", "/%E0%A4%A"],
  ])("rejects %s (%j)", (_label, input) => {
    expect(safeInternalPath(input)).toBeNull();
  });
});
