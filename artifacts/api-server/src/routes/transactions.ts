import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable } from "@workspace/db";
import { GetTransactionsQueryParams } from "@workspace/api-zod";
import { desc, eq, sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res): Promise<void> => {
  const parsed = GetTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { page = 1, limit = 20, type } = parsed.data;
  const offset = (page - 1) * limit;

  let query = db.select().from(transactionsTable).$dynamic();

  if (type) {
    query = query.where(eq(transactionsTable.type, type));
  }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactionsTable)
    .$dynamic();

  const transactions = await query
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({
    transactions: transactions.map((t) => ({
      id: String(t.id),
      type: t.type,
      status: t.status,
      amount: t.amount,
      amountUsd: t.amountUsd,
      token: t.token,
      fromAddress: t.fromAddress,
      toAddress: t.toAddress,
      toUsername: t.toUsername,
      fromUsername: t.fromUsername,
      txHash: t.txHash,
      note: t.note,
      createdAt: t.createdAt.toISOString(),
    })),
    total: Number(countResult?.count ?? 0),
    page,
    limit,
  });
});

router.get("/summary", async (req, res): Promise<void> => {
  req.log.info("Getting transaction summary");
  const transactions = await db.select().from(transactionsTable);

  const totalSentUsd = transactions
    .filter((t) => t.type === "send")
    .reduce((sum, t) => sum + t.amountUsd, 0);
  const totalReceivedUsd = transactions
    .filter((t) => t.type === "receive")
    .reduce((sum, t) => sum + t.amountUsd, 0);
  const totalGrantsUsd = transactions
    .filter((t) => t.type === "grant")
    .reduce((sum, t) => sum + t.amountUsd, 0);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthUsd = transactions
    .filter((t) => new Date(t.createdAt) >= startOfMonth)
    .reduce((sum, t) => sum + t.amountUsd, 0);

  res.json({
    totalSentUsd,
    totalReceivedUsd,
    totalGrantsUsd,
    transactionCount: transactions.length,
    thisMonthUsd,
  });
});

export default router;
