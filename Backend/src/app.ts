import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { openApiSpec } from "./docs/openapi";
import * as githubWebhookController from "./controllers/githubWebhook.controller";
import { authenticate } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { requireTrustedOrigin } from "./middleware/originCheck";
import { publicApiBase } from "./utils/uploadUrl";
import { authRoutes } from "./routes/auth.routes";
import { githubIntegrationRoutes } from "./routes/githubIntegration.routes";
import { issueRoutes } from "./routes/issue.routes";
import { organizationRoutes } from "./routes/organization.routes";
import { projectRoutes } from "./routes/project.routes";
import { sprintRoutes } from "./routes/sprint.routes";
import { transcriptionRoutes } from "./routes/transcription.routes";
import { uploadRoutes } from "./routes/upload.routes";
import swaggerUi from "swagger-ui-express";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Only trust X-Forwarded-For from known proxies, otherwise req.ip (rate limiting) is spoofable.
  app.set("trust proxy", env.TRUST_PROXY);
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      exposedHeaders: ["X-Total-Count", "X-Results-Truncated", "Retry-After"],
    }),
  );
  app.post(
    "/api/integrations/github/webhook/:webhookPathToken",
    // GitHub push/PR payloads can exceed the 100kb default.
    express.raw({ type: "application/json", limit: "5mb" }),
    (req, res) => void githubWebhookController.postGithubWebhook(req, res),
  );
  app.use(express.json());
  // Express 5 leaves req.body undefined when there is no body; controllers expect an object.
  app.use((req, _res, next) => {
    if (req.body === undefined) req.body = {};
    next();
  });
  app.use(cookieParser());
  // Frontend origins plus the API's own origin (Swagger UI "Try it out").
  app.use(
    requireTrustedOrigin([
      ...(Array.isArray(env.CORS_ORIGINS) ? env.CORS_ORIGINS : [env.CORS_ORIGINS]),
      new URL(publicApiBase()).origin,
    ]),
  );

  app.get("/api/openapi.json", (_req, res) => {
    res.json(openApiSpec);
  });
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      explorer: true,
      customSiteTitle: "Trackio API Docs",
      swaggerOptions: {
        displayRequestDuration: true,
        filter: true,
      },
    }),
  );

  app.use(authenticate);
  app.use(requestLogger);

  app.use("/api/auth", authRoutes);
  app.use("/api/integrations/github", githubIntegrationRoutes);
  app.use("/api/organizations", organizationRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/issues", issueRoutes);
  app.use("/api/sprints", sprintRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/transcriptions", transcriptionRoutes);

  app.use(errorHandler);
  return app;
}
