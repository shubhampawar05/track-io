import { createCipheriv, createHash, createHmac, randomBytes } from "crypto";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createIssue, createProject, registerUser, startApp, stopApp, type TestUser } from "./helpers";

process.env.GITHUB_OAUTH_ENCRYPTION_KEY = "k".repeat(48);

let app: Express;
let owner: TestUser;
beforeAll(async () => {
  app = await startApp("secrets");
  owner = await registerUser(app, "Owner", "owner@test.local");
});
afterAll(stopApp);

const sign = (body: string, secret: string) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
const ping = (token: string, body: string, signature: string) =>
  request(app)
    .post(`/api/integrations/github/webhook/${token}`)
    .set("Content-Type", "application/json")
    .set("X-GitHub-Event", "ping")
    .set("X-Hub-Signature-256", signature)
    .send(body);

describe("webhook secrets at rest", () => {
  it("stores the secret sealed and still verifies signed deliveries", async () => {
    const setup = await as(app, owner).post("/api/organizations/github/webhook-setup");
    expect(setup.status).toBe(200);
    const { webhookUrl, secret } = setup.body.data as { webhookUrl: string; secret: string };
    const token = webhookUrl.split("/").pop()!;

    const { Organization } = await import("../src/models/Organization");
    const org = await Organization.findById(owner.org).lean();
    expect(org!.githubWebhookSecret).not.toBe(secret);
    expect(org!.githubWebhookSecret!.startsWith("v2.")).toBe(true);

    const body = JSON.stringify({ zen: "hi" });
    expect((await ping(token, body, sign(body, secret))).status).toBe(200);
    expect((await ping(token, body, sign(body, "wrong-secret"))).status).toBe(401);
  });

  it("keeps accepting legacy plaintext secrets until migrated", async () => {
    const other = await registerUser(app, "Legacy", "legacy@test.local");
    const { Organization } = await import("../src/models/Organization");
    await Organization.updateOne({ _id: other.org }, { $set: { githubWebhookPathToken: "legacy-token", githubWebhookSecret: "plain-legacy-secret" } });
    const body = JSON.stringify({ zen: "legacy" });
    expect((await ping("legacy-token", body, sign(body, "plain-legacy-secret"))).status).toBe(200);
  });
});

describe("migrateSecrets", () => {
  it("re-seals legacy tokens and plaintext webhook secrets, idempotently", async () => {
    const { GithubIntegration } = await import("../src/models/GithubIntegration");
    const { Organization } = await import("../src/models/Organization");
    const { migrateSecrets } = await import("../src/services/secretMigration.service");
    const { decryptGithubAccessToken } = await import("../src/utils/githubTokenCrypto");

    // A token stored in the pre-v2 format with the old JWT_SECRET-derived key.
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(process.env.JWT_SECRET!, "utf8").digest(), iv);
    const enc = Buffer.concat([cipher.update("ghp_legacy_token", "utf8"), cipher.final()]);
    const legacyOrg = new mongoose.Types.ObjectId();
    await GithubIntegration.collection.insertOne({
      organizationId: legacyOrg,
      encryptedAccessToken: enc.toString("base64"),
      tokenIv: iv.toString("base64"),
      tokenAuthTag: cipher.getAuthTag().toString("base64"),
      githubUserId: "1",
      githubLogin: "legacy",
    });
    // A token nobody can decrypt.
    const brokenOrg = new mongoose.Types.ObjectId();
    await GithubIntegration.collection.insertOne({
      organizationId: brokenOrg,
      encryptedAccessToken: "AAAA",
      tokenIv: randomBytes(12).toString("base64"),
      tokenAuthTag: randomBytes(16).toString("base64"),
      githubUserId: "2",
      githubLogin: "broken",
    });

    const dry = await migrateSecrets({ dryRun: true });
    expect(dry.githubTokens.resealed).toBe(1);
    expect((await GithubIntegration.findOne({ organizationId: legacyOrg }).lean())!.encryptedAccessToken).toBeTruthy();

    const first = await migrateSecrets({ deleteUndecryptableTokens: true });
    expect(first.githubTokens.resealed).toBe(1);
    expect(first.githubTokens.undecryptable).toEqual([brokenOrg.toString()]);
    expect(first.githubTokens.deleted).toBe(1);
    expect(first.webhookSecrets.sealedFromPlaintext).toBeGreaterThanOrEqual(1);

    const migrated = await GithubIntegration.findOne({ organizationId: legacyOrg }).lean();
    expect(migrated!.encryptedAccessToken).toBeUndefined();
    expect(migrated!.sealedAccessToken!.startsWith("v2.")).toBe(true);
    expect(decryptGithubAccessToken(migrated!)).toBe("ghp_legacy_token");
    expect(await GithubIntegration.countDocuments({ organizationId: brokenOrg })).toBe(0);

    const orgs = await Organization.find({ githubWebhookSecret: { $exists: true } }).lean();
    expect(orgs.every((o) => o.githubWebhookSecret!.startsWith("v2."))).toBe(true);
    // The migrated legacy webhook still verifies.
    const body = JSON.stringify({ zen: "after" });
    expect((await ping("legacy-token", body, sign(body, "plain-legacy-secret"))).status).toBe(200);

    const second = await migrateSecrets({});
    expect(second.githubTokens.resealed).toBe(0);
    expect(second.githubTokens.alreadyCurrent).toBe(1);
    expect(second.webhookSecrets.sealedFromPlaintext + second.webhookSecrets.resealed).toBe(0);
  });
});

describe("renumberSortOrders", () => {
  it("spaces cards out per column, keeps their order and is idempotent", async () => {
    const { Issue } = await import("../src/models/Issue");
    const { renumberSortOrders, SORT_ORDER_GAP } = await import("../src/services/sortOrderMigration.service");
    const slug = await createProject(app, owner, "Order");
    const ids = [];
    for (let i = 0; i < 4; i++) ids.push(await createIssue(app, owner, slug, { title: `t${i}`, status: "todo" }));
    // Simulate old data: every card at 0 except one placed first explicitly.
    await Issue.updateMany({ displayId: { $in: ids } }, { $set: { sortOrder: 0 } });
    await Issue.updateOne({ displayId: ids[3] }, { $set: { sortOrder: -5 } });

    const report = await renumberSortOrders({});
    expect(report.updated).toBeGreaterThan(0);
    const after = await Issue.find({ displayId: { $in: ids } }).sort({ sortOrder: 1 }).lean();
    expect(after.map((i) => i.displayId)).toEqual([ids[3], ids[0], ids[1], ids[2]]);
    // Positions are distinct multiples of the gap (the project's starter "todo" issue shares
    // this column, so exact values depend on where it sorts).
    const orders = after.map((i) => i.sortOrder);
    expect(orders.every((o) => o % SORT_ORDER_GAP === 0)).toBe(true);
    expect(new Set(orders).size).toBe(orders.length);

    expect((await renumberSortOrders({})).updated).toBe(0);
  });

  it("appends new issues to the end of their column", async () => {
    const slug = await createProject(app, owner, "Append");
    const a = await createIssue(app, owner, slug, { title: "first", status: "backlog" });
    const b = await createIssue(app, owner, slug, { title: "second", status: "backlog" });
    const list = await as(app, owner).get(`/api/projects/${slug}/issues`);
    const backlog = (list.body.data as { id: string; status: string; sortOrder: number }[]).filter((i) => i.status === "backlog");
    const pos = (id: string) => backlog.find((i) => i.id === id)!.sortOrder;
    expect(pos(b)).toBeGreaterThan(pos(a));
    expect(Math.max(...backlog.map((i) => i.sortOrder))).toBe(pos(b));
  });
});
