import { Router } from "express";
import * as projectController from "../controllers/project.controller";
import { requireAuth } from "../middleware/auth";
import { requireOrganization } from "../middleware/organization";

export const projectRoutes = Router();

projectRoutes.use(requireAuth, requireOrganization);

projectRoutes.get("/", (req, res) => void projectController.list(req, res));
projectRoutes.post("/", (req, res) => void projectController.create(req, res));
projectRoutes.get("/:slug", (req, res) => void projectController.getBySlug(req, res));
projectRoutes.patch("/:slug", (req, res) => void projectController.patchBySlug(req, res));
projectRoutes.get("/:slug/issues", (req, res) => void projectController.listIssues(req, res));
projectRoutes.post("/:slug/issues", (req, res) => void projectController.createIssue(req, res));
projectRoutes.patch("/:slug/issues/:issueId", (req, res) => void projectController.patchIssue(req, res));
