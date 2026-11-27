import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";

export const authRoutes = Router();

authRoutes.get("/invite-preview", rateLimit("invite-preview", 40), (req, res) =>
  void authController.invitePreview(req, res),
);

authRoutes.post("/forgot-password", rateLimit("forgot-password", 8), (req, res) =>
  void authController.forgotPassword(req, res),
);
authRoutes.post("/reset-password", rateLimit("reset-password", 15), (req, res) =>
  void authController.resetPassword(req, res),
);

authRoutes.post("/accept-invite", requireAuth, rateLimit("accept-invite", 25), (req, res) =>
  void authController.acceptInvite(req, res),
);
authRoutes.post("/decline-invite", requireAuth, rateLimit("decline-invite", 25), (req, res) =>
  void authController.declineInvite(req, res),
);

authRoutes.get("/me", requireAuth, (req, res) => void authController.me(req, res));
authRoutes.patch("/me", requireAuth, (req, res) => void authController.patchMe(req, res));
authRoutes.post("/login", rateLimit("login", 40), (req, res) => void authController.login(req, res));
authRoutes.post("/register", rateLimit("register", 20), (req, res) => void authController.register(req, res));
authRoutes.post("/logout", requireAuth, (req, res) => void authController.logout(req, res));
