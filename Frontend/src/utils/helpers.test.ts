import { describe, expect, it } from "vitest";
import { isIssueDetailPath } from "@/utils/isIssueDetailPath";
import { normalizeIssueLabel } from "@/utils/issueLabels";
import {
  getIssuePriorityVisual,
  listRowAssigneeTooltip,
  normalizeIssuePriority,
} from "@/utils/issuePriority";
import type { Issue } from "@/types/issue";

describe("isIssueDetailPath", () => {
  it.each(["/issues/abc", "/issues/TRK-12"])("is true for %s", (p) => {
    expect(isIssueDetailPath(p)).toBe(true);
  });

  it.each(["/issues", "/issues/", "/issues/list", "/issues/board", "/issues/a/b", "/projects/x"])(
    "is false for %s",
    (p) => {
      expect(isIssueDetailPath(p)).toBe(false);
    },
  );
});

describe("normalizeIssueLabel", () => {
  it("keeps known labels (after trimming)", () => {
    expect(normalizeIssueLabel(" Bug ")).toBe("Bug");
  });

  it("falls back to General for unknown or differently-cased labels", () => {
    expect(normalizeIssueLabel("bug")).toBe("General");
    expect(normalizeIssueLabel("")).toBe("General");
  });
});

describe("normalizeIssuePriority", () => {
  it.each([
    ["HIGH", "high"],
    [" urgent ", "urgent"],
    ["low", "low"],
    ["none", "none"],
    ["", "none"],
    [null, "none"],
    [undefined, "none"],
    ["critical", "none"],
    [3, "none"],
  ])("normalises %j to %s", (raw, expected) => {
    expect(normalizeIssuePriority(raw)).toBe(expected);
  });

  it("maps priorities to their visual label", () => {
    expect(getIssuePriorityVisual("Urgent").label).toBe("Urgent");
    expect(getIssuePriorityVisual("bogus").label).toBe("No Priority");
  });
});

describe("listRowAssigneeTooltip", () => {
  const base = { assignee: "", assigneeName: null } as unknown as Issue;

  it.each(["", "—", "-", "   "])("shows Unassigned for placeholder assignee %j", (assignee) => {
    expect(listRowAssigneeTooltip({ ...base, assignee })).toBe("Unassigned");
  });

  it("prefers the assignee name, falling back to the raw assignee", () => {
    expect(listRowAssigneeTooltip({ ...base, assignee: "u1", assigneeName: " Ada " })).toBe("Ada");
    expect(listRowAssigneeTooltip({ ...base, assignee: "u1", assigneeName: "  " })).toBe("u1");
  });
});
