import { Router } from "express";
import { db } from "@workspace/db";
import { grantsTable, transactionsTable } from "@workspace/db";
import { ClaimGrantBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

router.get("/", async (req, res): Promise<void> => {
  req.log.info("Getting grants");
  const grants = await db.select().from(grantsTable);
  res.json(
    grants.map((g) => ({
      id: g.grantId,
      type: g.type,
      title: g.title,
      description: g.description,
      amountWld: g.amountWld,
      amountUsd: g.amountUsd,
      status: g.status,
      expiresAt: g.expiresAt ? g.expiresAt.toISOString() : null,
      requiresOrb: g.requiresOrb,
    }))
  );
});

router.post("/claim", async (req, res): Promise<void> => {
  const parsed = ClaimGrantBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid request body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { grantId } = parsed.data;

  const [grant] = await db
    .select()
    .from(grantsTable)
    .where(eq(grantsTable.grantId, grantId));

  if (!grant) {
    res.status(404).json({ error: "Grant not found" });
    return;
  }

  if (grant.status !== "available") {
    res.status(400).json({ error: "Grant is not available for claiming" });
    return;
  }

  await db
    .update(grantsTable)
    .set({ status: "claimed" })
    .where(eq(grantsTable.grantId, grantId));

  const txHash = `0x${Buffer.from(randomUUID().replace(/-/g, "")).toString("hex").slice(0, 64)}`;

  await db.insert(transactionsTable).values({
    txId: randomUUID(),
    type: "grant",
    status: "confirmed",
    amount: grant.amountWld,
    amountUsd: grant.amountUsd,
    token: "WLD",
    txHash,
    note: `Grant: ${grant.title}`,
  });

  req.log.info({ grantId, amountWld: grant.amountWld }, "Grant claimed");
  res.json({
    success: true,
    amountWld: grant.amountWld,
    amountUsd: grant.amountUsd,
    txHash,
  });
});

export default router;
