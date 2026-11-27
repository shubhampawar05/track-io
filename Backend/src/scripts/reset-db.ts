/**
 * Deletes all application documents from the database named in MONGODB_URI.
 * Run from Backend: npm run db:reset
 */
import "dotenv/config";
import mongoose from "mongoose";
import { assertSafeDatabaseTarget } from "./dbGuard";
import { Comment } from "../models/Comment";
import { GithubIntegration } from "../models/GithubIntegration";
import { Issue } from "../models/Issue";
import { Membership } from "../models/Membership";
import { Organization } from "../models/Organization";
import { OrganizationInvite } from "../models/OrganizationInvite";
import { Project } from "../models/Project";
import { Sprint } from "../models/Sprint";
import { TranscriptionRecording } from "../models/TranscriptionRecording";
import { User } from "../models/User";

const rawUri = process.env.MONGODB_URI?.trim();
if (!rawUri) {
  console.error(
    "Missing MONGODB_URI. Copy Backend/.env.example to Backend/.env and set your connection string.",
  );
  process.exit(1);
}

assertSafeDatabaseTarget(rawUri as string, "db:reset");

async function main() {
  await mongoose.connect(rawUri as string);
  const name = mongoose.connection.db?.databaseName ?? "(unknown)";
  console.log(`Resetting database: ${name}`);

  const results = await Promise.all([
    Comment.deleteMany({}),
    Issue.deleteMany({}),
    TranscriptionRecording.deleteMany({}),
    OrganizationInvite.deleteMany({}),
    GithubIntegration.deleteMany({}),
    Sprint.deleteMany({}),
    Membership.deleteMany({}),
    Project.deleteMany({}),
    Organization.deleteMany({}),
    User.deleteMany({}),
  ]);

  const total = results.reduce((n, r) => n + (r.deletedCount ?? 0), 0);
  console.log(`Deleted ${total} document(s) across Trackio collections.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
