/**
 * Auth middleware (aligned with Apple model).
 *
 * Resolution order per request:
 *   1. req.session.userId      — set by POST /auth/login (session-based, primary)
 *   2. X-World-User-Id header  — worldId string, developer/test convenience
 *   3. (no fallback)           — returns 401
 *
 * The demo-user fallback ("wld_1a2b3c4d5e6f7g8h9i0j" regardless of caller)
 * has been removed to close the auth boundary.  In development, set
 * X-World-User-Id to the seeded worldId, or POST /api/auth/login first.
 */

import { Request, Response, NextFunction } from "express";
import { db, identityTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type Identity = typeof identityTable.$inferSelect;

declare global {
  namespace Express {
    interface Request {
      currentUser: Identity;
    }
  }
}

export async function resolveUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  let user: Identity | undefined;

  // 1) Session-based auth (primary — set by POST /api/auth/login)
  const sessionUserId: number | undefined = (req.session as Record<string, unknown> | undefined)?.userId as number | undefined;
  if (sessionUserId) {
    const [found] = await db
      .select()
      .from(identityTable)
      .where(eq(identityTable.id, sessionUserId))
      .limit(1);
    user = found;
  }

  // 2) Developer header override (X-World-User-Id: wld_xxx)
  if (!user) {
    const worldIdHeader = req.headers["x-world-user-id"] as string | undefined;
    if (worldIdHeader) {
      const [found] = await db
        .select()
        .from(identityTable)
        .where(eq(identityTable.worldId, worldIdHeader))
        .limit(1);
      user = found;
      if (!user) {
        res.status(401).json({ error: "Unknown user", code: "UNAUTHORIZED" });
        return;
      }
    }
  }

  // 3) Neither — reject
  if (!user) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
    return;
  }

  req.currentUser = user;
  next();
}
