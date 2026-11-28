import { describe, expect, it } from "vitest";
import { buildIssueDetailUrl, resolveIssueCloseHref } from "@/lib/issue-detail-from";
import { slugifyColumnTitle } from "@/lib/board-columns-storage";

describe("buildIssueDetailUrl", () => {
  it("encodes the issue id and the origin view", () => {
    expect(buildIssueDetailUrl("a/b", { from: "board" })).toBe("/issues/a%2Fb?from=board");
  });

  it("includes project slug and view for project origin", () => {
    expect(buildIssueDetailUrl("TRK-1", { from: "project", projectSlug: "web app" })).toBe(
      "/issues/TRK-1?from=project&projectSlug=web+app&view=list",
    );
  });

  it("falls back to a plain from=project when no slug is given", () => {
    expect(buildIssueDetailUrl("TRK-1", { from: "project" })).toBe("/issues/TRK-1?from=project");
  });
});

describe("resolveIssueCloseHref", () => {
  const href = (q: string) => resolveIssueCloseHref(new URLSearchParams(q));

  it("returns to the originating list/board", () => {
    expect(href("from=list")).toBe("/issues/list");
    expect(href("from=board")).toBe("/issues/board");
  });

  it("returns to the project with an encoded slug and a sanitised view", () => {
    expect(href("from=project&projectSlug=a/b&view=board")).toBe("/projects/a%2Fb?view=board");
    expect(href("from=project&projectSlug=x&view=evil")).toBe("/projects/x?view=list");
  });

  it("defaults to the board", () => {
    expect(href("")).toBe("/issues/board");
    expect(href("from=project")).toBe("/issues/board");
  });
});

describe("slugifyColumnTitle", () => {
  it("lowercases, strips punctuation and collapses separators", () => {
    expect(slugifyColumnTitle("  In Review!! ")).toBe("in-review");
    expect(slugifyColumnTitle("QA__ready -- now")).toBe("qa-ready-now");
  });

  it("falls back to 'column' when nothing is left", () => {
    expect(slugifyColumnTitle("!!!")).toBe("column");
  });
});
