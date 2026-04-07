/**
 * User-context middleware.
 *
 * Resolution order:
 *   1. X-World-User-Id header  — worldId string (e.g. "wld_abc123")
 *   2. Fallback                — first identity row (dev/demo convenience)
 *
 * In production this header would be replaced by a signed JWT verified here.
 * The middleware attaches `req.currentUser` (the full Identity row) so every
 * downstream handler has user context without touching the DB again.
 *
 * If an explicit header is supplied but the user does not exist → 401.
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

const FALLBACK_WORLD_ID = "wld_1a2b3c4d5e6f7g8h9i0j";

export async function resolveUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const worldId = (req.headers["x-world-user-id"] as string | undefined) ?? FALLBACK_WORLD_ID;

  const [user] = await db
    .select()
    .from(identityTable)
    .where(eq(identityTable.worldId, worldId))
    .limit(1);

  if (!user) {
    if (req.headers["x-world-user-id"]) {
      res.status(401).json({ error: "Unknown user", code: "UNAUTHORIZED" });
      return;
    }
    res.status(404).json({ error: "No identity found. Run the seed script.", code: "IDENTITY_NOT_FOUND" });
    return;
  }

  req.currentUser = user;
  next();
}
