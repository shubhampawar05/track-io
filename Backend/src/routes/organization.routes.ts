import { Router } from "express";
import * as githubIntegrationController from "../controllers/githubIntegration.controller";
import * as organizationController from "../controllers/organization.controller";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { requireOrganization } from "../middleware/organization";

export const organizationRoutes = Router();

organizationRoutes.use(requireAuth, requireOrganization);

organizationRoutes.get("/issues-board-columns", (req, res) =>
  void organizationController.getIssuesBoardColumns(req, res),
);

organizationRoutes.post("/invites", rateLimit("org-invite", 20), (req, res) =>
  void organizationController.createInvite(req, res),
);
organizationRoutes.get("/invites", (req, res) => void organizationController.listInvites(req, res));
organizationRoutes.delete("/invites/:inviteId", rateLimit("org-invite-cancel", 30), (req, res) =>
  void organizationController.cancelInvite(req, res),
);
organizationRoutes.get("/members", (req, res) => void organizationController.listMembers(req, res));
organizationRoutes.patch("/", (req, res) => void organizationController.patchOrganization(req, res));

organizationRoutes.get("/github/status", (req, res) => void githubIntegrationController.githubStatus(req, res));
organizationRoutes.get("/github/oauth-url", (req, res) =>
  void githubIntegrationController.githubOauthUrl(req, res),
);
organizationRoutes.delete("/github", (req, res) => void githubIntegrationController.githubDisconnect(req, res));
organizationRoutes.post("/github/webhook-setup", (req, res) => void organizationController.postGithubWebhookSetup(req, res));
