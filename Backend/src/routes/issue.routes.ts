import { Router } from "express";
import * as issueController from "../controllers/issue.controller";
import { requireAuth } from "../middleware/auth";
import { requireOrganization } from "../middleware/organization";

export const issueRoutes = Router();

issueRoutes.use(requireAuth, requireOrganization);

issueRoutes.get("/", (req, res) => void issueController.listAll(req, res));
issueRoutes.post("/", (req, res) => void issueController.createGlobal(req, res));
issueRoutes.get("/:issueId", (req, res) => void issueController.getOne(req, res));
issueRoutes.patch(
  "/:issueId/comments/:commentId",
  (req, res) => void issueController.patchComment(req, res),
);
issueRoutes.patch("/:issueId", (req, res) => void issueController.patchOne(req, res));
issueRoutes.delete("/:issueId", (req, res) => void issueController.deleteOne(req, res));
issueRoutes.post("/:issueId/comments", (req, res) => void issueController.postComment(req, res));
issueRoutes.post("/:issueId/attachments", (req, res) => void issueController.postAttachment(req, res));
issueRoutes.delete(
  "/:issueId/attachments/:attachmentId",
  (req, res) => void issueController.deleteAttachment(req, res),
);
