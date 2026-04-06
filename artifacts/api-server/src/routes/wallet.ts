import { Router } from "express";
import { db } from "@workspace/db";
import { tokensTable, transactionsTable, identityTable } from "@workspace/db";
import { SendTokensBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

router.get("/", async (req, res): Promise<void> => {
  req.log.info("Getting wallet");
  const tokens = await db.select().from(tokensTable);
  const totalValueUsd = tokens.reduce((sum, t) => sum + t.balanceUsd, 0);
  const [identity] = await db.select().from(identityTable).limit(1);

  const change24hUsd = totalValueUsd * 0.032;
  const change24hPercent = 3.2;

  res.json({
    address: identity?.walletAddress ?? "0x0000000000000000000000000000000000000000",
    totalValueUsd,
    change24hPercent,
    change24hUsd,
    tokens: tokens.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      balance: t.balance,
      balanceUsd: t.balanceUsd,
      priceUsd: t.priceUsd,
      change24hPercent: t.change24hPercent,
      iconUrl: t.iconUrl,
      contractAddress: t.contractAddress,
      chain: t.chain,
    })),
  });
});

router.get("/tokens", async (req, res): Promise<void> => {
  req.log.info("Getting tokens");
  const tokens = await db.select().from(tokensTable);
  res.json(
    tokens.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      balance: t.balance,
      balanceUsd: t.balanceUsd,
      priceUsd: t.priceUsd,
      change24hPercent: t.change24hPercent,
      iconUrl: t.iconUrl,
      contractAddress: t.contractAddress,
      chain: t.chain,
    }))
  );
});

router.post("/send", async (req, res): Promise<void> => {
  const parsed = SendTokensBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid request body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { toAddress, amount, token, note } = parsed.data;

  const [tokenRecord] = await db
    .select()
    .from(tokensTable)
    .where(eq(tokensTable.symbol, token));

  const amountUsd = tokenRecord ? amount * tokenRecord.priceUsd : amount;

  const [identity] = await db.select().from(identityTable).limit(1);
  const txId = randomUUID();
  const txHash = `0x${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`.slice(0, 66);

  const [tx] = await db
    .insert(transactionsTable)
    .values({
      txId,
      type: "send",
      status: "confirmed",
      amount,
      amountUsd,
      token,
      fromAddress: identity?.walletAddress ?? null,
      toAddress,
      txHash,
      note: note ?? null,
    })
    .returning();

  req.log.info({ txId, amount, token }, "Transaction sent");
  res.json({
    id: String(tx.id),
    type: tx.type,
    status: tx.status,
    amount: tx.amount,
    amountUsd: tx.amountUsd,
    token: tx.token,
    fromAddress: tx.fromAddress,
    toAddress: tx.toAddress,
    txHash: tx.txHash,
    note: tx.note,
    createdAt: tx.createdAt.toISOString(),
  });
});

router.get("/receive", async (req, res): Promise<void> => {
  req.log.info("Getting receive info");
  const [identity] = await db.select().from(identityTable).limit(1);
  const address = identity?.walletAddress ?? "0x742d35Cc6634C0532925a3b8D4C9f5e7Aa5bFCe";
  const username = identity?.username ?? "worlduser";
  res.json({
    address,
    qrCodeData: `ethereum:${address}`,
    username,
  });
});

export default router;
