/**
 * Centralized error handler.
 *
 * Catches all unhandled errors thrown by route handlers and returns a
 * consistent JSON error contract:
 *
 *   { "error": "human-readable message", "code": "MACHINE_CODE" }
 *
 * HTTP status codes:
 *   400  — validation / domain errors (AppError with status 4xx)
 *   500  — unexpected server errors
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly status: number = 400,
    public readonly code: string = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    req.log?.warn({ code: err.code, status: err.status }, err.message);
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  logger.error({ err, url: req.url, method: req.method }, "Unhandled server error");
  res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
}
