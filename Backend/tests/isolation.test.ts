import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createIssue, createProject, registerUser, startApp, stopApp, uploadPng, type TestUser } from "./helpers";

let app: Express;
let alice: TestUser;
let bob: TestUser;
let aliceSlug: string;
let aliceIssue: string;

beforeAll(async () => {
  app = await startApp("isolation");
  alice = await registerUser(app, "Alice", "alice@test.local");
  bob = await registerUser(app, "Bob", "bob@test.local");
  aliceSlug = await createProject(app, alice, "Alpha");
  aliceIssue = await createIssue(app, alice, aliceSlug, { title: "Secret" });
});
afterAll(stopApp);

describe("organization isolation", () => {
  it("requires auth and an organization header", async () => {
    expect((await request(app).get("/api/issues").set("X-Organization-Id", alice.org)).status).toBe(401);
    expect((await request(app).get("/api/issues").set("Cookie", alice.cookie)).status).toBe(400);
  });

  it("forbids using another org's id in the header", async () => {
    const res = await request(app).get("/api/issues").set("Cookie", bob.cookie).set("X-Organization-Id", alice.org);
    expect(res.status).toBe(403);
  });

  it.each([
    ["GET", () => as(app, bob).get(`/api/issues/${aliceIssue}`)],
    ["PATCH", () => as(app, bob).patch(`/api/issues/${aliceIssue}`).send({ title: "pwn" })],
    ["DELETE", () => as(app, bob).delete(`/api/issues/${aliceIssue}`)],
    ["project", () => as(app, bob).get(`/api/projects/${aliceSlug}`)],
  ])("hides another org's data from %s with 404", async (_m, run) => {
    expect((await run()).status).toBe(404);
  });

  it("does not leak another org's issues into lists", async () => {
    const res = await as(app, bob).get("/api/issues");
    expect(res.status).toBe(200);
    expect(res.body.data.map((i: { id: string }) => i.id)).not.toContain(aliceIssue);
  });

  it("returns 404 (never 500) for malformed ids and encoded %", async () => {
    for (const path of ["/api/issues/notanid", "/api/issues/%25", "/api/projects/%25", "/api/issues/64b000000000000000000000"]) {
      expect((await as(app, alice).get(path)).status, path).toBe(404);
    }
  });

  it("returns 404 (not 403) to org members outside the project", async () => {
    const { Project } = await import("../src/models/Project");
    const { Membership } = await import("../src/models/Membership");
    const mongoose = (await import("mongoose")).default;
    // Carol joins Alice's org but is not added to the project.
    const carol = await registerUser(app, "Carol", "carol@test.local");
    await Membership.create({ userId: new mongoose.Types.ObjectId(carol.id), organizationId: new mongoose.Types.ObjectId(alice.org), role: "member" });
    const carolInAlice = { ...carol, org: alice.org };
    const project = await Project.findOne({ slug: aliceSlug }).lean();
    expect(project!.memberIds.map(String)).not.toContain(carol.id);
    expect((await as(app, carolInAlice).get(`/api/issues/${aliceIssue}`)).status).toBe(404);
  });
});

describe("cross-org attachments", () => {
  it("cannot attach or delete another workspace's file", async () => {
    const aliceFile = await uploadPng(app, alice);
    const bobSlug = await createProject(app, bob, "Beta");
    const bobIssue = await createIssue(app, bob, bobSlug);
    const meta = { filename: "x.png", size: 12, mimeType: "image/png", url: aliceFile };

    expect((await as(app, bob).post(`/api/issues/${bobIssue}/attachments`).send(meta)).status).toBe(400);
    const comment = await as(app, bob)
      .post(`/api/issues/${bobIssue}/comments`)
      .send({ body: "hi", attachments: [{ id: "c1", ...meta }] });
    expect(comment.status).toBe(400);
    // Alice's file is untouched.
    expect((await request(app).get(aliceFile).set("Cookie", alice.cookie)).status).toBe(200);
    // And Bob cannot download it either.
    expect((await request(app).get(aliceFile).set("Cookie", bob.cookie)).status).toBe(404);
  });
});
