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

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : "Something went wrong";
  const status = err instanceof HttpError ? err.status : 500;
  res.status(status).json(fail(status === 500 ? "Something went wrong" : message));
}
