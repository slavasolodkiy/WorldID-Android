/**
 * Session-based auth routes (aligned with Apple model).
 *
 *   POST /auth/login   — look up user by worldId or username, create session
 *   POST /auth/logout  — destroy session
 *   GET  /auth/me      — return current session info (no DB hit)
 *
 * The `resolveUser` middleware then uses req.session.userId as the primary
 * auth signal, with X-World-User-Id as a developer header override.
 */

import { Router } from "express";
import { z } from "zod";
import { db, identityTable } from "@workspace/db";
import { or, eq } from "drizzle-orm";

const router = Router();

const LoginBody = z.object({
  worldId: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
}).refine((d) => d.worldId || d.username, {
  message: "worldId or username is required",
});

router.post("/auth/login", async (req, res, next): Promise<void> => {
  try {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Validation error", code: "VALIDATION_ERROR" });
      return;
    }

    const { worldId, username } = parsed.data;
    const conditions = [];
    if (worldId) conditions.push(eq(identityTable.worldId, worldId));
    if (username) conditions.push(eq(identityTable.username, username));

    const [user] = await db
      .select()
      .from(identityTable)
      .where(or(...conditions))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Unknown user", code: "UNAUTHORIZED" });
      return;
    }

    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        req.log.error({ err }, "Failed to save session");
        res.status(500).json({ error: "Session error", code: "INTERNAL_ERROR" });
        return;
      }
      req.log.info({ userId: user.id, username: user.username }, "User logged in");
      res.json({
        userId: String(user.id),
        worldId: user.worldId,
        username: user.username,
        verificationLevel: user.verificationLevel,
      });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/auth/logout", (req, res, next): void => {
  req.session.destroy((err) => {
    if (err) {
      next(err);
      return;
    }
    res.clearCookie("world.sid");
    res.json({ ok: true });
  });
});

router.get("/auth/me", async (req, res, next): Promise<void> => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      res.json({ userId: null });
      return;
    }

    const [user] = await db
      .select()
      .from(identityTable)
      .where(eq(identityTable.id, userId))
      .limit(1);

    if (!user) {
      res.json({ userId: null });
      return;
    }

    res.json({
      userId: String(user.id),
      worldId: user.worldId,
      username: user.username,
      verificationLevel: user.verificationLevel,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
