import nodemailer from "nodemailer";
import { env } from "../config/env";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!env.SMTP_HOST || !env.MAIL_FROM) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
  });
  return transporter;
}

export function isMailConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.MAIL_FROM);
}

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/** Sends email when SMTP is configured; otherwise logs in development only. */
export async function sendMail(input: SendMailInput): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    // eslint-disable-next-line no-console
    console.info("[mail] (no SMTP) would send to %s: %s\n%s", input.to, input.subject, input.text);
    return;
  }
  await transport.sendMail({
    from: env.MAIL_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
