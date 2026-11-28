import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { HttpError } from "../middleware/errorHandler";
import { User } from "../models/User";
import { buildPasswordResetMail } from "./emailTemplates";
import { sendMail } from "./mail.service";
import { hashToken, randomUrlToken } from "../utils/tokenCrypto";

const RESET_TTL_MS = 60 * 60 * 1000;

const GENERIC_FORGOT_MSG =
  "If an account exists for that email, we sent password reset instructions.";

export async function requestPasswordReset(emailRaw: string): Promise<{ message: string }> {
  const email = emailRaw.toLowerCase().trim();
  if (!email) return { message: GENERIC_FORGOT_MSG };
  const user = await User.findOne({ email });
  if (!user) return { message: GENERIC_FORGOT_MSG };
  const token = randomUrlToken();
  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + RESET_TTL_MS);
  await user.save();
  const link = `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  const mail = buildPasswordResetMail({ recipientName: user.name ?? "", resetUrl: link });
  // Send in the background: waiting on SMTP only for existing accounts would let response
  // time reveal which emails are registered.
  void sendMail({
    to: user.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  }).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error("[mail] password reset send failed", err);
  });
  return { message: GENERIC_FORGOT_MSG };
}

export async function resetPasswordWithToken(tokenRaw: string, newPassword: string): Promise<void> {
  const token = tokenRaw.trim();
  if (!token || !newPassword || newPassword.length < 8) {
    throw new HttpError(400, "Invalid token or password (min 8 characters)");
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  // Consume the token atomically so two concurrent requests cannot both use it.
  // Bumping tokenVersion signs out every existing session (the old password may be compromised).
  const user = await User.findOneAndUpdate(
    { passwordResetTokenHash: hashToken(token), passwordResetExpiresAt: { $gt: new Date() } },
    {
      $set: { passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null },
      $inc: { tokenVersion: 1 },
    },
  ).exec();
  if (!user) {
    throw new HttpError(400, "Invalid or expired reset link");
  }
}
