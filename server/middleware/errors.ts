import type { NextFunction, Request, RequestHandler, Response } from "express";

export type ErrorBody = {
  error: string;
  message?: string;
  details?: unknown;
};

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message?: string, details?: unknown) {
    super(message || code);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function apiNotFound(_req: Request, res: Response): void {
  res.status(404).json({ error: "not_found", message: "Unknown API route" } satisfies ErrorBody);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;

  if (err instanceof HttpError) {
    const body: ErrorBody = { error: err.code, message: err.message };
    if (err.details !== undefined) body.details = err.details;
    res.status(err.status).json(body);
    return;
  }

  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "invalid_json", message: "Request body must be valid JSON" } satisfies ErrorBody);
    return;
  }

  console.error("[api]", err);
  res.status(500).json({
    error: "internal_error",
    message: "Unexpected server error",
  } satisfies ErrorBody);
}
