import { Router } from "express";
import * as githubIntegrationController from "../controllers/githubIntegration.controller";
import { requireAuth } from "../middleware/auth";

export const githubIntegrationRoutes = Router();

githubIntegrationRoutes.get("/callback", requireAuth, (req, res) =>
  void githubIntegrationController.githubOAuthCallback(req, res),
);
