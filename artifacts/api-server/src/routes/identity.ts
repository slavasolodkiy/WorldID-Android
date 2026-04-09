import { Router } from "express";
import { z } from "zod";
import { InitiateVerificationBody } from "@workspace/api-zod";
import { IdentityService } from "../services/identity.service";
import { AppError } from "../middlewares/error";

const router = Router();

router.get("/", async (req, res, next): Promise<void> => {
  try {
    req.log.info("Getting identity");
    const identity = await IdentityService.getIdentity(req.currentUser.id);
    res.json({
      id: String(identity.id),
      worldId: identity.worldId,
      username: identity.username,
      avatarUrl: identity.avatarUrl,
      verificationLevel: identity.verificationLevel,
      isVerified: identity.isVerified,
      nullifierHash: identity.nullifierHash,
      walletAddress: identity.walletAddress,
      joinedAt: identity.joinedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/verify", async (req, res, next): Promise<void> => {
  try {
    const parsed = InitiateVerificationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      return;
    }

    const session = await IdentityService.initiateVerification(
      req.currentUser.id,
      parsed.data.level as "device" | "orb",
    );

    req.log.info({ sessionId: session.sessionId, level: session.level, reused: session.reused }, "Verification session");
    res.json({
      sessionId: session.sessionId,
      status: session.status,
      level: session.level,
      expiresAt: session.expiresAt.toISOString(),
      reused: session.reused,
    });
  } catch (err) {
    next(err);
  }
});

const CompleteVerificationBody = z.object({
  sessionId: z.string().min(1),
  nullifierHash: z.string().optional(),
  merkleRoot: z.string().optional(),
  proof: z.string().optional(),
});

/**
 * Complete verification — aligns Android with Apple's lifecycle completion model.
 * Atomically: marks session completed + upgrades level + issues credential.
 * Idempotent: calling again with same sessionId returns success without re-writing.
 */
router.post("/verify/complete", async (req, res, next): Promise<void> => {
  try {
    const parsed = CompleteVerificationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      return;
    }

    const { sessionId, nullifierHash, merkleRoot, proof } = parsed.data;

    const result = await IdentityService.completeVerification(
      req.currentUser.id,
      sessionId,
      { nullifierHash, merkleRoot, proof },
    );

    req.log.info(
      { sessionId, level: result.level, upgraded: !result.alreadyCompleted },
      "Verification completed",
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/verify/sessions", async (req, res, next): Promise<void> => {
  try {
    const sessions = await IdentityService.getVerificationSessions(req.currentUser.id);
    res.json(
      sessions.map((s) => ({
        sessionId: s.sessionId,
        status: s.status,
        level: s.level,
        expiresAt: s.expiresAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.get("/credentials", async (req, res, next): Promise<void> => {
  try {
    req.log.info("Getting credentials");
    const credentials = await IdentityService.getCredentials(req.currentUser.id);
    res.json(
      credentials.map((c) => ({
        id: String(c.id),
        type: c.type,
        label: c.label,
        issuedAt: c.issuedAt.toISOString(),
        expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
        isActive: c.isActive,
      })),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
