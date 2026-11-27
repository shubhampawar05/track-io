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

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const status = res.statusCode;
    const userPart = req.userId ? ` user=${req.userId}` : "";
    const orgPart = req.organizationId ? ` org=${req.organizationId.toString()}` : "";
    const line =
      `[${timestampNow()}] ${req.method} ${req.originalUrl} ` +
      `${statusColor(status)}${status}${RESET} ${elapsedMs.toFixed(1)}ms${userPart}${orgPart}`;

    // eslint-disable-next-line no-console
    console.log(line);
  });

  next();
}
