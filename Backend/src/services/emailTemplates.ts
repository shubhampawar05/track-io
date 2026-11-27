import { env } from "../config/env";

const ACCENT = "#5e6ad2";
const TEXT = "#374151";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const PAGE_BG = "#f3f4f6";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function brandName(): string {
  return env.APP_NAME;
}

function originLabel(): string {
  try {
    return new URL(env.FRONTEND_ORIGIN.replace(/\/$/, "")).host;
  } catch {
    return env.FRONTEND_ORIGIN.replace(/\/$/, "");
  }
}

type LayoutParams = {
  preheader: string;
  heading: string;
  innerHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  textBlocks: string[];
};

/**
 * Table-based HTML for broad email client support; plain text mirrors the same story.
 */
function layoutTransactional(params: LayoutParams): { html: string; text: string } {
  const brand = escapeHtml(brandName());
  const { preheader, heading, innerHtml, ctaLabel, ctaUrl, textBlocks } = params;
  const safeUrl = escapeHtml(ctaUrl);
  const safeCta = escapeHtml(ctaLabel);

  const text = [...textBlocks, "", `— ${brandName()}`, originLabel()].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAGE_BG};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;border:1px solid ${BORDER};">
          <tr>
            <td style="padding:28px 28px 8px 28px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.04em;color:${MUTED};text-transform:uppercase;">${brand}</p>
              <h1 style="margin:14px 0 0;font-size:20px;line-height:1.35;color:#111827;font-weight:600;">${escapeHtml(heading)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 8px 28px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6;color:${TEXT};">
              ${innerHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px 28px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius:8px;background:${ACCENT};">
                    <a href="${safeUrl}" style="display:inline-block;padding:12px 22px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${safeCta}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.5;color:${MUTED};">
                If the button does not work, copy and paste this link into your browser:<br>
                <a href="${safeUrl}" style="color:${ACCENT};word-break:break-all;">${safeUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px 28px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.5;color:${MUTED};border-top:1px solid ${BORDER};">
              <p style="margin:16px 0 0;">You are receiving this because someone used this address with ${brand}. If this was not you, you can safely ignore this message.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text };
}

export function buildPasswordResetMail(input: { recipientName: string; resetUrl: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const name = input.recipientName.trim() || "there";
  const heading = "Reset your password";
  const preheader = `Password reset for your ${brandName()} account — link expires in 1 hour.`;
  const innerHtml = `<p style="margin:0 0 12px;">Hi ${escapeHtml(name)},</p>
<p style="margin:0 0 12px;">We received a request to reset the password for your account. Use the button below to choose a new password. This link <strong>expires in 1 hour</strong> for your security.</p>
<p style="margin:0;">If you did not request a reset, you can ignore this email and your password will stay the same.</p>`;

  const textBlocks = [
    `Hi ${name},`,
    "",
    "We received a request to reset the password for your account. Open the link below to choose a new password. This link expires in 1 hour.",
    "",
    input.resetUrl,
    "",
    "If you did not request a reset, ignore this email.",
  ];

  const { html, text } = layoutTransactional({
    preheader,
    heading,
    innerHtml,
    ctaLabel: "Reset password",
    ctaUrl: input.resetUrl,
    textBlocks,
  });

  return {
    subject: `Reset your ${brandName()} password`,
    text,
    html,
  };
}

export function buildOrganizationInviteMail(input: {
  inviterName: string;
  organizationName: string;
  inviteeEmail: string;
  roleLabel: string;
  acceptUrl: string;
}): { subject: string; text: string; html: string } {
  const inviter = input.inviterName.trim() || "A teammate";
  const org = input.organizationName.trim() || "a workspace";
  const heading = `Join ${org} on ${brandName()}`;
  const preheader = `${inviter} invited you to collaborate — accept before the link expires.`;
  const innerHtml = `<p style="margin:0 0 12px;"><strong>${escapeHtml(inviter)}</strong> invited you to join <strong>${escapeHtml(org)}</strong> on ${escapeHtml(brandName())}.</p>
<p style="margin:0 0 12px;">You will join as <strong>${escapeHtml(input.roleLabel)}</strong>. Sign in or create an account using <strong>${escapeHtml(input.inviteeEmail)}</strong>, then open the invitation link.</p>
<p style="margin:0;">This invitation link <strong>expires in 7 days</strong>.</p>`;

  const textBlocks = [
    `${inviter} invited you to join "${org}" on ${brandName()}.`,
    "",
    `Role: ${input.roleLabel}`,
    `Use this email when you sign up or sign in: ${input.inviteeEmail}`,
    "",
    "Accept the invitation:",
    input.acceptUrl,
    "",
    "This link expires in 7 days.",
  ];

  const { html, text } = layoutTransactional({
    preheader,
    heading,
    innerHtml,
    ctaLabel: "Accept invitation",
    ctaUrl: input.acceptUrl,
    textBlocks,
  });

  return {
    subject: `You're invited to ${org} on ${brandName()}`,
    text,
    html,
  };
}
