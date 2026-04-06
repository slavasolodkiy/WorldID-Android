import { Router } from "express";
import { db } from "@workspace/db";
import {
  identityTable,
  credentialsTable,
  verificationSessionsTable,
} from "@workspace/db";
import {
  InitiateVerificationBody,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

router.get("/", async (req, res): Promise<void> => {
  req.log.info("Getting identity");
  const [identity] = await db.select().from(identityTable).limit(1);
  if (!identity) {
    res.status(404).json({ error: "Identity not found" });
    return;
  }
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
});

router.post("/verify", async (req, res): Promise<void> => {
  const parsed = InitiateVerificationBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid request body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { level } = parsed.data;
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [identity] = await db.select().from(identityTable).limit(1);
  if (!identity) {
    res.status(404).json({ error: "Identity not found" });
    return;
  }

  await db.insert(verificationSessionsTable).values({
    sessionId,
    identityId: identity.id,
    status: "pending",
    level,
    expiresAt,
  });

  req.log.info({ sessionId, level }, "Verification session created");
  res.json({
    sessionId,
    status: "pending",
    level,
    expiresAt: expiresAt.toISOString(),
  });
});

router.get("/credentials", async (req, res): Promise<void> => {
  req.log.info("Getting credentials");
  const credentials = await db.select().from(credentialsTable).orderBy(credentialsTable.issuedAt);
  res.json(
    credentials.map((c) => ({
      id: String(c.id),
      type: c.type,
      label: c.label,
      issuedAt: c.issuedAt.toISOString(),
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
      isActive: c.isActive,
    }))
  );
});

export default router;
