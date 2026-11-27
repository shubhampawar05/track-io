import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { byBodyEmail, rateLimit } from "../middleware/rateLimit";

const FIFTEEN_MINUTES = 15 * 60_000;

export const authRoutes = Router();

authRoutes.get("/invite-preview", rateLimit("invite-preview", 40), (req, res) =>
  void authController.invitePreview(req, res),
);

authRoutes.post(
  "/forgot-password",
  rateLimit("forgot-password", 8),
  rateLimit("forgot-password-account", 5, { windowMs: FIFTEEN_MINUTES, keyBy: byBodyEmail }),
  (req, res) =>
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
authRoutes.post(
  "/login",
  rateLimit("login", 40),
  // Per-account cap so rotating IPs cannot brute-force a single password.
  rateLimit("login-account", 10, { windowMs: FIFTEEN_MINUTES, keyBy: byBodyEmail }),
  (req, res) => void authController.login(req, res),
);
authRoutes.post("/register", rateLimit("register", 20), (req, res) => void authController.register(req, res));
authRoutes.post("/logout", (req, res) => void authController.logout(req, res));
