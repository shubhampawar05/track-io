import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LIMITS } from "../src/utils/inputLimits";
import { as, createIssue, createProject, registerUser, startApp, stopApp, uploadPng, type TestUser } from "./helpers";

let app: Express;
let user: TestUser;
let slug: string;

beforeAll(async () => {
  app = await startApp("issues");
  user = await registerUser(app, "Owner", "owner@test.local");
  slug = await createProject(app, user, "Gamma");
});
afterAll(stopApp);

describe("issue numbering", () => {
  it("allocates unique keys under concurrent creates", async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) => as(app, user).post(`/api/projects/${slug}/issues`).send({ title: `c${i}` })),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    const keys = results.map((r) => r.body.data.id as string);
    expect(new Set(keys).size).toBe(25);
  });

  it("never reuses the key of a deleted issue", async () => {
    const id = await createIssue(app, user, slug, { title: "newest" });
    const n = Number(id.split("-")[1]);
    expect((await as(app, user).delete(`/api/issues/${id}`)).status).toBe(200);
    const next = await createIssue(app, user, slug, { title: "after delete" });
    expect(Number(next.split("-")[1])).toBe(n + 1);
  });

  it("creates same-named projects concurrently with unique slugs and key prefixes", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => as(app, user).post("/api/projects").send({ name: "Delta" })));
    expect(results.map((r) => r.status)).toEqual(Array(8).fill(200));
    const slugs = results.map((r) => r.body.data.slug as string);
    expect(new Set(slugs).size).toBe(8);
    const { Project } = await import("../src/models/Project");
    const prefixes = (await Project.find({ slug: { $in: slugs } }).lean()).map((p) => p.keyPrefix);
    expect(new Set(prefixes).size).toBe(8);
  });
});

describe("validation", () => {
  it("rejects statuses that are not a board column, accepts real ones", async () => {
    const id = await createIssue(app, user, slug);
    expect((await as(app, user).patch(`/api/issues/${id}`).send({ status: "garbage" })).status).toBe(400);
    expect((await as(app, user).patch(`/api/projects/${slug}/issues/${id}`).send({ status: "bogus" })).status).toBe(400);
    expect((await as(app, user).post(`/api/projects/${slug}/issues`).send({ title: "x", status: "bogus" })).status).toBe(400);
    const ok = await as(app, user).patch(`/api/issues/${id}`).send({ status: "in-progress" });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe("in-progress");
  });

  it.each([
    ["empty title", { title: "   " }],
    ["600-char title", { title: "t".repeat(600) }],
    ["huge description", { description: "d".repeat(100_001) }],
  ])("rejects %s with 400", async (_label, body) => {
    const id = await createIssue(app, user, slug);
    expect((await as(app, user).patch(`/api/issues/${id}`).send(body)).status).toBe(400);
  });

  it("rejects operator objects instead of passing them to Mongo", async () => {
    const r1 = await as(app, user).post("/api/issues").send({ title: "x", projectSlug: { $ne: null } });
    expect(r1.status).toBe(400);
    const r2 = await as(app, user).post("/api/issues").send({ title: "x", projectSlug: slug, status: { $gt: "" } });
    expect(r2.status).toBe(400);
  });

  it("returns 400 (not 500) for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{bad json");
    expect(res.status).toBe(400);
  });

  it("caps comment length", async () => {
    const id = await createIssue(app, user, slug);
    expect((await as(app, user).post(`/api/issues/${id}/comments`).send({ body: "c".repeat(10_001) })).status).toBe(400);
    expect((await as(app, user).post(`/api/issues/${id}/comments`).send({ body: "hello" })).status).toBe(200);
  });
});

describe("org-wide list", () => {
  it("returns an array with total/truncation headers", async () => {
    const res = await as(app, user).get("/api/issues");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(Number(res.headers["x-total-count"])).toBe(res.body.data.length);
    expect(res.headers["x-results-truncated"]).toBe("false");
    expect(res.headers["x-next-offset"]).toBeUndefined();
  });

  it("pages with limit/offset without overlap or gaps", async () => {
    const all = await as(app, user).get("/api/issues");
    const total = Number(all.headers["x-total-count"]);
    expect(total).toBeGreaterThan(5);
    const seen: string[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = await as(app, user).get(`/api/issues?limit=3&offset=${offset}`);
      expect(page.status).toBe(200);
      expect(page.body.data.length).toBeLessThanOrEqual(3);
      expect(Number(page.headers["x-total-count"])).toBe(total);
      seen.push(...page.body.data.map((i: { id: string }) => i.id));
      const next = page.headers["x-next-offset"];
      expect(page.headers["x-results-truncated"]).toBe(next ? "true" : "false");
      offset = next ? Number(next) : null;
    }
    expect(new Set(seen).size).toBe(total);
    expect(new Set(seen)).toEqual(new Set(all.body.data.map((i: { id: string }) => i.id)));
  });

  it("clamps invalid paging params", async () => {
    const res = await as(app, user).get("/api/issues?limit=abc&offset=-5");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(Number(res.headers["x-total-count"]));
  });
});

describe("subtasks and deletion", () => {
  it("unlinks subtasks and removes unreferenced files when an issue is deleted", async () => {
    const parent = await createIssue(app, user, slug, { title: "parent" });
    const child = await createIssue(app, user, slug, { title: "child" });
    const file = await uploadPng(app, user);
    await as(app, user).post(`/api/issues/${child}/attachments`).send({ filename: "x.png", size: 12, mimeType: "image/png", url: file });
    const linked = await as(app, user)
      .patch(`/api/issues/${parent}`)
      .send({ subtasks: [{ id: "s1", title: "child work", done: false, linkedIssueId: child }, { id: "s2", title: "other", done: false }] });
    expect(linked.status).toBe(200);

    expect((await as(app, user).delete(`/api/issues/${child}`)).status).toBe(200);

    const after = await as(app, user).get(`/api/issues/${parent}`);
    expect(after.body.data.subtasks.map((s: { linkedIssueId: string | null }) => s.linkedIssueId ?? null)).toEqual([null, null]);
    expect((await request(app).get(file).set("Cookie", user.cookie)).status).toBe(404);

    // Editing the remaining subtasks still works.
    const toggled = await as(app, user)
      .patch(`/api/issues/${parent}`)
      .send({ subtasks: after.body.data.subtasks.map((s: { id: string; title: string }) => ({ ...s, done: true })) });
    expect(toggled.status).toBe(200);
  });

  it("an existing dangling link does not block other subtask edits", async () => {
    const { Issue } = await import("../src/models/Issue");
    const parent = await createIssue(app, user, slug, { title: "p2" });
    // Simulate legacy data: a link to an issue that no longer exists.
    await Issue.updateOne({ displayId: parent }, { $set: { subtasks: [{ id: "s1", title: "old", done: false, linkedIssueId: "GAM-99999" }] } });
    const res = await as(app, user)
      .patch(`/api/issues/${parent}`)
      .send({ subtasks: [{ id: "s1", title: "old", done: true, linkedIssueId: "GAM-99999" }] });
    expect(res.status).toBe(200);
    // A *new* dangling link is still rejected.
    const bad = await as(app, user)
      .patch(`/api/issues/${parent}`)
      .send({ subtasks: [{ id: "s1", title: "old", done: true, linkedIssueId: "GAM-99999" }, { id: "s2", title: "new", done: false, linkedIssueId: "GAM-88888" }] });
    expect(bad.status).toBe(400);
  });
});

describe("input size limits", () => {
  it("accepts a description at the maximum length (JSON body limit is large enough)", async () => {
    // Worst case for body size: multi-byte characters plus quotes that JSON must escape.
    const description = "é\"".repeat(LIMITS.issueDescription / 2);
    const res = await as(app, user).post(`/api/projects/${slug}/issues`).send({ title: "big", description });
    expect(res.status).toBe(200);
  });

  it("rejects a description over the limit with 400, not 413", async () => {
    const description = "a".repeat(LIMITS.issueDescription + 1);
    const res = await as(app, user).post(`/api/projects/${slug}/issues`).send({ title: "too big", description });
    expect(res.status).toBe(400);
  });
});
