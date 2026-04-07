import { Router } from "express";
import { InitiateVerificationBody } from "@workspace/api-zod";
import { IdentityService } from "../services/identity.service";

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

    req.log.info({ sessionId: session.sessionId, level: session.level }, "Verification session created");
    res.json({
      sessionId: session.sessionId,
      status: session.status,
      level: session.level,
      expiresAt: session.expiresAt.toISOString(),
    });
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
