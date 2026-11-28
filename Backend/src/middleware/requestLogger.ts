import type { NextFunction, Request, Response } from "express";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function timestampNow(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

function statusColor(status: number): string {
  if (status >= 500) return "\x1b[31m";
  if (status >= 400) return "\x1b[33m";
  if (status >= 300) return "\x1b[36m";
  if (status >= 200) return "\x1b[32m";
  return "\x1b[0m";
}

const RESET = "\x1b[0m";

/** Query parameters that carry bearer-equivalent secrets (invite/reset tokens, OAuth code/state). */
const SENSITIVE_QUERY_KEYS = new Set(["token", "code", "state"]);

/** originalUrl with secret query values replaced, so logs never hold usable tokens. */
function redactedUrl(req: Request): string {
  const raw = req.originalUrl;
  const q = raw.indexOf("?");
  if (q < 0) return raw;
  const params = new URLSearchParams(raw.slice(q + 1));
  for (const key of [...params.keys()]) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) params.set(key, "[redacted]");
  }
  return `${raw.slice(0, q)}?${params.toString()}`;
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const status = res.statusCode;
    const userPart = req.userId ? ` user=${req.userId}` : "";
    const orgPart = req.organizationId ? ` org=${req.organizationId.toString()}` : "";
    const line =
      `[${timestampNow()}] ${req.method} ${redactedUrl(req)} ` +
      `${statusColor(status)}${status}${RESET} ${elapsedMs.toFixed(1)}ms${userPart}${orgPart}`;

    // eslint-disable-next-line no-console
    console.log(line);
  });

  next();
}
