import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createIssue, createProject, registerUser, startApp, stopApp, uploadPng, type TestUser } from "./helpers";

let app: Express;
let user: TestUser;
let slug: string;
const meta = { filename: "x.png", size: 12, mimeType: "image/png" };

beforeAll(async () => {
  app = await startApp("attachments");
  user = await registerUser(app, "Uploader", "up@test.local");
  slug = await createProject(app, user, "Files");
});
afterAll(stopApp);

const fileStatus = async (url: string) => (await request(app).get(url).set("Cookie", user.cookie)).status;

describe("uploads", () => {
  it("rejects content that does not match the declared type", async () => {
    const res = await as(app, user)
      .post("/api/uploads")
      .attach("file", Buffer.from("<html>not an image</html>"), { filename: "x.png", contentType: "image/png" });
    expect(res.status).toBe(400);
  });

  it("serves files with nosniff, a sandboxed CSP and an escaped filename", async () => {
    const url = await uploadPng(app, user, 'we"ird.png');
    const res = await request(app).get(url).set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toContain("sandbox");
    expect(res.headers["content-disposition"]).toContain('filename="we_ird.png"');
  });

  it("requires a session to download", async () => {
    const url = await uploadPng(app, user);
    expect((await request(app).get(url)).status).toBe(401);
  });
});

describe("attachment reference counting", () => {
  it("keeps a file while any issue still references it (relative or absolute URL)", async () => {
    const url = await uploadPng(app, user);
    const i1 = await createIssue(app, user, slug);
    const i2 = await createIssue(app, user, slug);
    const a1 = await as(app, user).post(`/api/issues/${i1}/attachments`).send({ ...meta, url });
    const a2 = await as(app, user).post(`/api/issues/${i2}/attachments`).send({ ...meta, url: `http://127.0.0.1:4999${url}` });
    expect(a1.status).toBe(200);
    expect(a2.status).toBe(200);

    await as(app, user).delete(`/api/issues/${i2}/attachments/${a2.body.data.id}`);
    expect(await fileStatus(url)).toBe(200);

    await as(app, user).delete(`/api/issues/${i1}/attachments/${a1.body.data.id}`);
    expect(await fileStatus(url)).toBe(404);
  });

  it("keeps a file that is embedded in an issue description", async () => {
    const url = await uploadPng(app, user);
    await createIssue(app, user, slug, { description: `<p><img src="http://127.0.0.1:4999${url}"></p>` });
    const holder = await createIssue(app, user, slug);
    const att = await as(app, user).post(`/api/issues/${holder}/attachments`).send({ ...meta, url });
    await as(app, user).delete(`/api/issues/${holder}/attachments/${att.body.data.id}`);
    expect(await fileStatus(url)).toBe(200);
  });

  it("deletes description-embedded files with their issue unless another issue still uses them", async () => {
    const own = await uploadPng(app, user);
    const shared = await uploadPng(app, user);
    const doomed = await createIssue(app, user, slug, {
      description: `<p><img src="${own}"><img src="http://127.0.0.1:4999${shared}"></p>`,
    });
    await createIssue(app, user, slug, { description: `<p><img src="${shared}"></p>` });
    expect((await as(app, user).delete(`/api/issues/${doomed}`)).status).toBe(200);
    expect(await fileStatus(own)).toBe(404);
    expect(await fileStatus(shared)).toBe(200);
  });

  it("rejects untrusted or non-existent attachment URLs", async () => {
    const id = await createIssue(app, user, slug);
    for (const url of ["javascript:alert(1)", "https://evil.example/x.png", "/api/uploads/files/64b000000000000000000000"]) {
      expect((await as(app, user).post(`/api/issues/${id}/attachments`).send({ ...meta, url })).status, url).toBe(400);
    }
  });
});
