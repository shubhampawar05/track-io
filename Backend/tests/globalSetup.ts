import type { TestProject } from "vitest/node";
import { MongoMemoryServer } from "mongodb-memory-server";

let memoryServer: MongoMemoryServer | undefined;

/**
 * One MongoDB for the whole run. Uses TEST_MONGODB_URI when provided (CI service container),
 * otherwise starts an in-memory server. Each test file then uses its own database name.
 */
export default async function setup(project: TestProject) {
  let uri = process.env.TEST_MONGODB_URI?.trim();
  if (!uri) {
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }
  project.provide("mongoBaseUri", uri.replace(/\/[^/?]*(\?.*)?$/, "/"));
  return async () => {
    await memoryServer?.stop();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoBaseUri: string;
  }
}
