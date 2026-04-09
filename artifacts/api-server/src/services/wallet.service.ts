import { db, tokensTable, transactionsTable, identityTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { AppError } from "../middlewares/error";

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function n(val: string | null): number {
  return parseFloat(val ?? "0") || 0;
}

export class WalletService {
  static async getWallet(identityId: number) {
    const [identity] = await db
      .select()
      .from(identityTable)
      .where(eq(identityTable.id, identityId))
      .limit(1);

    const tokens = await db
      .select()
      .from(tokensTable)
      .where(eq(tokensTable.identityId, identityId));

    const totalValueUsd = tokens.reduce((sum, t) => sum + n(t.balanceUsd), 0);
    const change24hUsd = totalValueUsd * 0.032;
    const change24hPercent = 3.2;

    return {
      address: identity?.walletAddress ?? "0x0000000000000000000000000000000000000000",
      totalValueUsd,
      change24hPercent,
      change24hUsd,
      tokens: tokens.map((t) => ({
        symbol: t.symbol,
        name: t.name,
        balance: n(t.balance),
        balanceUsd: n(t.balanceUsd),
        priceUsd: n(t.priceUsd),
        change24hPercent: t.change24hPercent ?? 0,
        iconUrl: t.iconUrl,
        contractAddress: t.contractAddress,
        chain: t.chain,
      })),
    };
  }

  static async getTokens(identityId: number) {
    const tokens = await db
      .select()
      .from(tokensTable)
      .where(eq(tokensTable.identityId, identityId));

    return tokens.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      balance: n(t.balance),
      balanceUsd: n(t.balanceUsd),
      priceUsd: n(t.priceUsd),
      change24hPercent: t.change24hPercent ?? 0,
      iconUrl: t.iconUrl,
      contractAddress: t.contractAddress,
      chain: t.chain,
    }));
  }

  /**
   * Atomically send tokens.
   *
   * Concurrency safety: uses a single UPDATE ... WHERE balance >= amount SQL
   * statement instead of read-then-write, eliminating TOCTOU race conditions.
   *
   * Idempotency: callers may pass an idempotencyKey (X-Idempotency-Key header).
   * If a transaction with that key already exists, the existing record is
   * returned (HTTP 200) without re-debiting the balance.
   */
  static async send(
    identityId: number,
    walletAddress: string,
    toAddress: string,
    amount: number,
    token: string,
    note?: string,
    idempotencyKey?: string,
  ) {
    // --- Pre-flight validation (no DB writes yet) ---
    if (!ETH_ADDRESS_RE.test(toAddress)) {
      throw new AppError(
        "Invalid destination address. Must be a 0x-prefixed 40-hex-character Ethereum address.",
        400,
        "INVALID_ADDRESS",
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError("Amount must be greater than zero.", 400, "INVALID_AMOUNT");
    }

    if (toAddress.toLowerCase() === walletAddress.toLowerCase()) {
      throw new AppError("Cannot send to own address.", 400, "SELF_SEND");
    }

    // --- Idempotency check: return existing tx if key already seen ---
    if (idempotencyKey) {
      const [existing] = await db
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.idempotencyKey, idempotencyKey));

      if (existing) {
        return {
          id: String(existing.id),
          type: existing.type,
          status: existing.status,
          amount: n(existing.amount),
          amountUsd: n(existing.amountUsd),
          token: existing.token,
          fromAddress: existing.fromAddress,
          toAddress: existing.toAddress,
          txHash: existing.txHash,
          note: existing.note,
          createdAt: existing.createdAt.toISOString(),
          idempotent: true,
        };
      }
    }

    // --- Verify token exists in user's wallet ---
    const [tokenRecord] = await db
      .select()
      .from(tokensTable)
      .where(and(eq(tokensTable.identityId, identityId), eq(tokensTable.symbol, token)));

    if (!tokenRecord) {
      throw new AppError(`Token ${token} not found in your wallet.`, 404, "TOKEN_NOT_FOUND");
    }

    const priceUsd = n(tokenRecord.priceUsd);
    const amountUsd = amount * priceUsd;
    const txId = randomUUID();
    const txHash = `0x${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`.slice(0, 66);

    // --- Atomic debit: UPDATE WHERE balance >= amount (prevents TOCTOU races) ---
    const tx = await db.transaction(async (trx) => {
      const updated = await trx
        .update(tokensTable)
        .set({
          balance: sql`${tokensTable.balance} - ${amount.toFixed(8)}::numeric`,
          balanceUsd: sql`(${tokensTable.balance} - ${amount.toFixed(8)}::numeric) * ${priceUsd.toFixed(6)}::numeric`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tokensTable.id, tokenRecord.id),
            sql`${tokensTable.balance} >= ${amount.toFixed(8)}::numeric`,
          )
        )
        .returning({ id: tokensTable.id });

      if (updated.length === 0) {
        throw new AppError(
          `Insufficient ${token} balance.`,
          400,
          "INSUFFICIENT_BALANCE",
        );
      }

      const [inserted] = await trx
        .insert(transactionsTable)
        .values({
          identityId,
          txId,
          idempotencyKey: idempotencyKey ?? null,
          type: "send",
          status: "confirmed",
          amount: amount.toFixed(8),
          amountUsd: amountUsd.toFixed(6),
          token,
          fromAddress: walletAddress,
          toAddress,
          txHash,
          note: note ?? null,
        })
        .returning();

      return inserted;
    });

    return {
      id: String(tx.id),
      type: tx.type,
      status: tx.status,
      amount: n(tx.amount),
      amountUsd: n(tx.amountUsd),
      token: tx.token,
      fromAddress: tx.fromAddress,
      toAddress: tx.toAddress,
      txHash: tx.txHash,
      note: tx.note,
      createdAt: tx.createdAt.toISOString(),
    };
  }

  static async getReceiveInfo(identityId: number) {
    const [identity] = await db
      .select()
      .from(identityTable)
      .where(eq(identityTable.id, identityId))
      .limit(1);

    const address = identity?.walletAddress ?? "0x0000000000000000000000000000000000000000";
    const username = identity?.username ?? "worlduser";

    return {
      address,
      qrCodeData: `ethereum:${address}`,
      username,
    };
  }
}
