import type { Request, RequestHandler, Response } from "express";
import type { RoleRequirement } from "../types";

type RequireAuth = (req: Request, res: Response) => boolean;
type RequireAlliance = (req: Request, res: Response) => string | null;
type RequireRole = (
  req: Request,
  res: Response,
  roles?: RoleRequirement[]
) => boolean;

export default function createAccessMiddleware({
  requireAuth,
  requireAlliance,
  requireRole,
}: {
  requireAuth: RequireAuth;
  requireAlliance: RequireAlliance;
  requireRole: RequireRole;
}): {
  requireAuthMiddleware: RequestHandler;
  requireAllianceMiddleware: RequestHandler;
  requireRoleMiddleware: (roles?: RoleRequirement[]) => RequestHandler;
} {
  function requireAuthMiddleware(req: Request, res: Response, next: () => void) {
    if (!requireAuth(req, res)) return;
    next();
  }

  function requireAllianceMiddleware(
    req: Request,
    res: Response,
    next: () => void
  ) {
    if (!requireAlliance(req, res)) return;
    next();
  }

  function requireRoleMiddleware(roles: RoleRequirement[] = []) {
    return (req: Request, res: Response, next: () => void) => {
      if (!requireRole(req, res, roles)) return;
      next();
    };
  }

  return {
    requireAuthMiddleware,
    requireAllianceMiddleware,
    requireRoleMiddleware,
  };
}
