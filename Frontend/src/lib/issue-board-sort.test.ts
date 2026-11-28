import { describe, expect, it } from "vitest";
import {
  boardStatusRank,
  buildBoardItemMap,
  cloneBoardItemMap,
  compareIssuesBoard,
  computeBoardMoveUpdate,
  emptyBoardItemMap,
  findBoardItemContainer,
} from "@/lib/issue-board-sort";
import type { Issue } from "@/types/issue";

function issue(id: string, status: string, sortOrder?: number, extra: Partial<Issue> = {}): Issue {
  return {
    id,
    key: id.toUpperCase(),
    title: id,
    status,
    priority: "none",
    label: "General",
    assignee: "",
    date: "2026-01-01",
    sortOrder,
    projectId: "proj",
    ...extra,
  };
}

const COLUMNS = ["backlog", "todo", "in-progress", "done"];

describe("boardStatusRank", () => {
  it("orders known statuses by workflow and puts unknown ones last", () => {
    expect(boardStatusRank("backlog")).toBe(0);
    expect(boardStatusRank("canceled")).toBe(4);
    expect(boardStatusRank("custom-column")).toBe(1000);
  });
});

describe("compareIssuesBoard", () => {
  it("sorts by status rank, then project, then sortOrder, then key", () => {
    const issues = [
      issue("d", "done", 0),
      issue("t2", "todo", 5, { projectId: "b" }),
      issue("t1", "todo", 9, { projectId: "a" }),
      issue("t4", "todo", 1, { projectId: "b", key: "Z" }),
      issue("t3", "todo", 1, { projectId: "b", key: "A" }),
      issue("x", "custom", 0),
      issue("bk", "backlog", 100),
    ];
    expect([...issues].sort(compareIssuesBoard).map((i) => i.id)).toEqual([
      "bk",
      "t1",
      "t3",
      "t4",
      "t2",
      "d",
      "x",
    ]);
  });
});

describe("buildBoardItemMap", () => {
  it("groups issue ids per column ordered by sortOrder then key, ignoring other statuses", () => {
    const issues = [
      issue("b", "todo", 2),
      issue("a", "todo", 1),
      issue("c", "todo", 1, { key: "0" }),
      issue("d", "done"),
      issue("z", "canceled", 0),
    ];
    expect(buildBoardItemMap(issues, COLUMNS)).toEqual({
      backlog: [],
      todo: ["c", "a", "b"],
      "in-progress": [],
      done: ["d"],
    });
  });
});

describe("emptyBoardItemMap / cloneBoardItemMap", () => {
  it("creates an empty list per column", () => {
    expect(emptyBoardItemMap(["todo", "done"])).toEqual({ todo: [], done: [] });
  });

  it("deep-copies column arrays", () => {
    const original = { todo: ["a"], done: [] as string[] };
    const copy = cloneBoardItemMap(original);
    copy.todo.push("b");
    expect(original.todo).toEqual(["a"]);
    expect(copy).toEqual({ todo: ["a", "b"], done: [] });
  });
});

describe("findBoardItemContainer", () => {
  const board = { todo: ["a", "b"], done: ["c"] };

  it("returns the column key when given a column id", () => {
    expect(findBoardItemContainer("done", board)).toBe("done");
  });

  it("returns the column containing an issue id", () => {
    expect(findBoardItemContainer("b", board)).toBe("todo");
  });

  it("returns undefined for unknown ids", () => {
    expect(findBoardItemContainer("nope", board)).toBeUndefined();
  });
});

describe("computeBoardMoveUpdate", () => {
  const baseline = [
    issue("a", "todo", 10),
    issue("b", "todo", 20),
    issue("c", "todo", 30),
    issue("d", "done", 5),
  ];
  const baselineMap = { backlog: [], todo: ["a", "b", "c"], done: ["d"] };

  it("returns null when the card stays in the same column and position", () => {
    expect(computeBoardMoveUpdate(baseline, baselineMap, cloneBoardItemMap(baselineMap), "b")).toBeNull();
  });

  it("uses the midpoint of the new neighbours when moving within a column", () => {
    const finalMap = { ...baselineMap, todo: ["b", "a", "c"] };
    // "a" now sits between b (20) and c (30)
    expect(computeBoardMoveUpdate(baseline, baselineMap, finalMap, "a")).toEqual({
      issueId: "a",
      projectSlug: "proj",
      status: "todo",
      sortOrder: 25,
    });
  });

  it("produces fractional midpoints between adjacent integers", () => {
    const tight = [issue("a", "todo", 1), issue("b", "todo", 2), issue("c", "todo", 3)];
    const before = { todo: ["a", "b", "c"] };
    const after = { todo: ["a", "c", "b"] };
    expect(computeBoardMoveUpdate(tight, before, after, "c")?.sortOrder).toBe(1.5);
  });

  it("places a card moved to the top just above the first card", () => {
    const finalMap = { ...baselineMap, todo: ["c", "a", "b"] };
    expect(computeBoardMoveUpdate(baseline, baselineMap, finalMap, "c")?.sortOrder).toBe(9);
  });

  it("places a card moved to the bottom just below the last card", () => {
    const finalMap = { ...baselineMap, todo: ["b", "c", "a"] };
    expect(computeBoardMoveUpdate(baseline, baselineMap, finalMap, "a")?.sortOrder).toBe(31);
  });

  it("uses sortOrder 0 and the new status when dropped into an empty column", () => {
    const finalMap = { backlog: ["b"], todo: ["a", "c"], done: ["d"] };
    expect(computeBoardMoveUpdate(baseline, baselineMap, finalMap, "b")).toEqual({
      issueId: "b",
      projectSlug: "proj",
      status: "backlog",
      sortOrder: 0,
    });
  });

  it("changes status when moved across columns, even at the same index", () => {
    const finalMap = { backlog: [], todo: ["b", "c"], done: ["a", "d"] };
    expect(computeBoardMoveUpdate(baseline, baselineMap, finalMap, "a")).toEqual({
      issueId: "a",
      projectSlug: "proj",
      status: "done",
      sortOrder: 4,
    });
  });

  it("treats neighbours without a finite sortOrder as 0", () => {
    const issues = [issue("a", "todo"), issue("b", "todo", Number.NaN), issue("c", "todo", 8)];
    const before = { todo: ["a", "b", "c"] };
    const after = { todo: ["b", "c", "a"] };
    // "a" moves to the bottom below c (8)
    expect(computeBoardMoveUpdate(issues, before, after, "a")?.sortOrder).toBe(9);
    // "c" moves to the top above a (undefined -> 0)
    expect(computeBoardMoveUpdate(issues, before, { todo: ["c", "a", "b"] }, "c")?.sortOrder).toBe(-1);
  });

  it("returns null for unknown issues, issues without a project, or ids missing from the final map", () => {
    const finalMap = { ...baselineMap, todo: ["b", "a", "c"] };
    expect(computeBoardMoveUpdate(baseline, baselineMap, finalMap, "zzz")).toBeNull();
    const noProject = [issue("a", "todo", 1, { projectId: undefined }), issue("b", "todo", 2)];
    expect(computeBoardMoveUpdate(noProject, { todo: ["a", "b"] }, { todo: ["b", "a"] }, "a")).toBeNull();
    expect(computeBoardMoveUpdate(baseline, baselineMap, { todo: ["b", "c"] }, "a")).toBeNull();
  });
});
