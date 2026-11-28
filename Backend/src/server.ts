import mongoose from "mongoose";
import { createApp } from "./app";
import { env } from "./config/env";
import { publicApiBase } from "./utils/uploadUrl";

// Backstop: a stray rejected promise from a route handler must not take the whole API down.
process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled promise rejection", reason);
});

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    const baseUrl = publicApiBase();
    // eslint-disable-next-line no-console
    console.log(
      [
        `Trackio API listening on ${baseUrl}`,
        ...(env.ENABLE_API_DOCS
          ? [`Swagger UI: ${baseUrl}/api/docs`, `OpenAPI JSON: ${baseUrl}/api/openapi.json`]
          : []),
      ].join("\n"),
    );
  });

  // Graceful shutdown: stop accepting connections, let in-flight requests finish, then close Mongo.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    // eslint-disable-next-line no-console
    console.log(`${signal} received, shutting down…`);
    const force = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.error("Shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    force.unref();
    server.close(() => {
      mongoose
        .disconnect()
        .catch(() => undefined)
        .finally(() => process.exit(0));
    });
    server.closeIdleConnections();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
