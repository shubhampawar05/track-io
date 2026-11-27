import mongoose from "mongoose";
import { createApp } from "./app";
import { env } from "./config/env";
import { publicApiBase } from "./utils/uploadUrl";

// Backstop: a stray rejected promise from a route handler must not take the whole API down.
process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled promise rejection", reason);
});

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  const app = createApp();
  app.listen(env.PORT, () => {
    const baseUrl = publicApiBase();
    // eslint-disable-next-line no-console
    console.log(
      [
        `Trackio API listening on ${baseUrl}`,
        `Swagger UI: ${baseUrl}/api/docs`,
        `OpenAPI JSON: ${baseUrl}/api/openapi.json`,
      ].join("\n"),
    );
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
