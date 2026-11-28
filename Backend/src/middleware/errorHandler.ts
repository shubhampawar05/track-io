import type { NextFunction, Request, Response } from "express";
import { fail } from "../types/api";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Client-error status carried by framework errors (body-parser: malformed JSON 400, too large 413, …). */
function clientErrorStatus(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { status?: unknown; statusCode?: unknown };
  const s = typeof e.status === "number" ? e.status : typeof e.statusCode === "number" ? e.statusCode : null;
  return s !== null && s >= 400 && s < 500 ? s : null;
}

const CLIENT_ERROR_MESSAGES: Record<number, string> = {
  400: "Invalid request",
  413: "Request body too large",
  415: "Unsupported content type",
};

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  // A streamed response (e.g. file download) already started: let Express close the socket.
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json(fail(err.status >= 500 ? "Something went wrong" : err.message));
    return;
  }
  const clientStatus = clientErrorStatus(err);
  if (clientStatus !== null) {
    // Framework messages can echo request internals; return a fixed message per status.
    res.status(clientStatus).json(fail(CLIENT_ERROR_MESSAGES[clientStatus] ?? "Invalid request"));
    return;
  }
  // eslint-disable-next-line no-console
  console.error(`Unhandled error on ${req.method} ${req.path}`, err);
  res.status(500).json(fail("Something went wrong"));
}
