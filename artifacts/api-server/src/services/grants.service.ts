import { db, grantsTable, tokensTable, transactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { AppError } from "../middlewares/error";

function n(val: string | null): number {
  return parseFloat(val ?? "0") || 0;
}

export class GrantsService {
  static async getGrants(identityId: number) {
    const grants = await db
      .select()
      .from(grantsTable)
      .where(eq(grantsTable.identityId, identityId));

    return grants.map((g) => ({
      id: g.grantId,
      type: g.type,
      title: g.title,
      description: g.description,
      amountWld: n(g.amountWld),
      amountUsd: n(g.amountUsd),
      status: g.status,
      expiresAt: g.expiresAt ? g.expiresAt.toISOString() : null,
      requiresOrb: g.requiresOrb,
    }));
  }

  static async claim(
    identityId: number,
    walletAddress: string,
    verificationLevel: string,
    grantId: string,
  ) {
    const [grant] = await db
      .select()
      .from(grantsTable)
      .where(and(eq(grantsTable.grantId, grantId), eq(grantsTable.identityId, identityId)));

    if (!grant) {
      throw new AppError("Grant not found or does not belong to this user.", 404, "GRANT_NOT_FOUND");
    }

    if (grant.status === "claimed") {
      throw new AppError("Grant has already been claimed.", 409, "ALREADY_CLAIMED");
    }

    if (grant.status === "expired") {
      throw new AppError("Grant has expired.", 400, "GRANT_EXPIRED");
    }

    if (grant.status !== "available") {
      throw new AppError("Grant is not available for claiming.", 400, "GRANT_UNAVAILABLE");
    }

    if (grant.expiresAt && new Date() > grant.expiresAt) {
      await db
        .update(grantsTable)
        .set({ status: "expired" })
        .where(eq(grantsTable.id, grant.id));
      throw new AppError("Grant has expired.", 400, "GRANT_EXPIRED");
    }

    if (grant.requiresOrb && verificationLevel !== "orb") {
      throw new AppError(
        "This grant requires Orb verification. Visit an Orb location to upgrade.",
        403,
        "ORB_VERIFICATION_REQUIRED",
      );
    }

    const amountWld = n(grant.amountWld);
    const amountUsd = n(grant.amountUsd);

    const [wldToken] = await db
      .select()
      .from(tokensTable)
      .where(and(eq(tokensTable.identityId, identityId), eq(tokensTable.symbol, "WLD")));

    const txHash = `0x${Buffer.from(randomUUID().replace(/-/g, "")).toString("hex").slice(0, 64)}`;
    const txId = randomUUID();

    const result = await db.transaction(async (trx) => {
      await trx
        .update(grantsTable)
        .set({ status: "claimed" })
        .where(eq(grantsTable.id, grant.id));

      if (wldToken) {
        const currentBalance = n(wldToken.balance);
        const newBalance = currentBalance + amountWld;
        const priceUsd = n(wldToken.priceUsd);
        const newBalanceUsd = newBalance * priceUsd;

        await trx
          .update(tokensTable)
          .set({
            balance: newBalance.toFixed(8),
            balanceUsd: newBalanceUsd.toFixed(6),
            updatedAt: new Date(),
          })
          .where(eq(tokensTable.id, wldToken.id));
      }

      await trx.insert(transactionsTable).values({
        identityId,
        txId,
        type: "grant",
        status: "confirmed",
        amount: amountWld.toFixed(8),
        amountUsd: amountUsd.toFixed(6),
        token: "WLD",
        toAddress: walletAddress,
        txHash,
        note: `Grant: ${grant.title}`,
      });

      return { success: true, amountWld, amountUsd, txHash };
    });

    return result;
  }
}
