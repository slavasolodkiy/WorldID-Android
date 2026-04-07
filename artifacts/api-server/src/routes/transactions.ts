import { Router } from "express";
import { db, transactionsTable } from "@workspace/db";
import { GetTransactionsQueryParams } from "@workspace/api-zod";
import { desc, eq, and, sql } from "drizzle-orm";

const router = Router();

function n(val: string | null): number {
  return parseFloat(val ?? "0") || 0;
}

router.get("/", async (req, res, next): Promise<void> => {
  try {
    const parsed = GetTransactionsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      return;
    }

    const { page = 1, limit = 20, type } = parsed.data;

    if (page < 1 || limit < 1 || limit > 200) {
      res.status(400).json({ error: "page must be >= 1 and limit must be between 1 and 200.", code: "VALIDATION_ERROR" });
      return;
    }
    const offset = (page - 1) * limit;
    const identityId = req.currentUser.id;

    const baseFilter = type
      ? and(eq(transactionsTable.identityId, identityId), eq(transactionsTable.type, type))
      : eq(transactionsTable.identityId, identityId);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactionsTable)
      .where(baseFilter);

    const transactions = await db
      .select()
      .from(transactionsTable)
      .where(baseFilter)
      .orderBy(desc(transactionsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      transactions: transactions.map((t) => ({
        id: String(t.id),
        type: t.type,
        status: t.status,
        amount: n(t.amount),
        amountUsd: n(t.amountUsd),
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
  } catch (err) {
    next(err);
  }
});

router.get("/summary", async (req, res, next): Promise<void> => {
  try {
    req.log.info("Getting transaction summary");
    const identityId = req.currentUser.id;

    const transactions = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.identityId, identityId));

    const totalSentUsd = transactions
      .filter((t) => t.type === "send")
      .reduce((sum, t) => sum + n(t.amountUsd), 0);
    const totalReceivedUsd = transactions
      .filter((t) => t.type === "receive")
      .reduce((sum, t) => sum + n(t.amountUsd), 0);
    const totalGrantsUsd = transactions
      .filter((t) => t.type === "grant")
      .reduce((sum, t) => sum + n(t.amountUsd), 0);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthUsd = transactions
      .filter((t) => new Date(t.createdAt) >= startOfMonth)
      .reduce((sum, t) => sum + n(t.amountUsd), 0);

    res.json({
      totalSentUsd,
      totalReceivedUsd,
      totalGrantsUsd,
      transactionCount: transactions.length,
      thisMonthUsd,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
