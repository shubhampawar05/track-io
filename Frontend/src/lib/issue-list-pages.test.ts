import { describe, expect, it } from "vitest";
import { fail, ok } from "./api-response";
import { fetchAllIssuePages } from "./issue-list-pages";

type Row = { id: string };

/** Fake API over `rows` with the backend's paging headers. */
function fakeApi(rows: Row[], pageSize: number) {
  const calls: string[] = [];
  const fetchPage = async (url: string) => {
    calls.push(url);
    const offset = Number(new URL(url, "http://x").searchParams.get("offset") ?? 0);
    const data = rows.slice(offset, offset + pageSize);
    const headers = new Headers({ "X-Total-Count": String(rows.length) });
    if (offset + data.length < rows.length) headers.set("X-Next-Offset", String(offset + data.length));
    return { headers, payload: ok(data) };
  };
  return { fetchPage, calls };
}

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `T-${i}` }));

describe("fetchAllIssuePages", () => {
  it("returns a single page when nothing follows", async () => {
    const api = fakeApi(rows(3), 10);
    const r = await fetchAllIssuePages("/api/issues", api.fetchPage);
    expect(r).toEqual({ issues: rows(3), total: 3 });
    expect(api.calls).toEqual(["/api/issues"]);
  });

  it("follows X-Next-Offset and keeps existing query params", async () => {
    const api = fakeApi(rows(7), 3);
    const r = await fetchAllIssuePages("/api/issues?status=todo", api.fetchPage);
    expect(r.issues.map((i) => i.id)).toEqual(rows(7).map((i) => i.id));
    expect(r.total).toBe(7);
    expect(api.calls).toEqual(["/api/issues?status=todo", "/api/issues?status=todo&offset=3", "/api/issues?status=todo&offset=6"]);
  });

  it("stops at maxPages and reports the full total", async () => {
    const api = fakeApi(rows(10), 2);
    const r = await fetchAllIssuePages("/api/issues", api.fetchPage, 2);
    expect(r.issues).toHaveLength(4);
    expect(r.total).toBe(10);
  });

  it("throws on an error page", async () => {
    const fetchPage = async () => ({
      headers: new Headers(),
      payload: fail("boom"),
    });
    await expect(fetchAllIssuePages<Row>("/api/issues", fetchPage)).rejects.toThrow("boom");
  });
});
