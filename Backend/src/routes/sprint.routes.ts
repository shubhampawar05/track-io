import { Router } from "express";
import * as sprintController from "../controllers/sprint.controller";
import { requireAuth } from "../middleware/auth";
import { requireOrganization } from "../middleware/organization";

export const sprintRoutes = Router();

sprintRoutes.use(requireAuth, requireOrganization);

sprintRoutes.get("/active", (req, res) => void sprintController.getActive(req, res));
