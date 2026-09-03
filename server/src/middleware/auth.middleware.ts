import type { NextFunction, Request, Response } from "express";
import { requireAuth } from './require-auth.middleware.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  void requireAuth(req, res, next);
}
