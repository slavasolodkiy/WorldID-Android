/**
 * Deterministic seed pipeline.
 *
 * Safe to run multiple times — uses ON CONFLICT DO NOTHING / DO UPDATE so
 * existing rows are not duplicated and the schema state is always reproducible.
 *
 * Run:  pnpm --filter @workspace/db run seed
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  identityTable,
  credentialsTable,
  tokensTable,
  transactionsTable,
  grantsTable,
  miniAppsTable,
} from "./schema";
import { eq, sql } from "drizzle-orm";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function seed() {
  console.log("Seeding database...");

  const [identity] = await db
    .insert(identityTable)
    .values({
      worldId: "wld_1a2b3c4d5e6f7g8h9i0j",
      username: "satoshi_w",
      verificationLevel: "orb",
      isVerified: true,
      nullifierHash: "0xab12cd34ef56gh78ij90kl12mn34op56qr78st90",
      walletAddress: "0x742d35Cc6634C0532925a3b8D4C9f5e7Aa5bFCe",
      joinedAt: new Date("2025-08-01T00:00:00Z"),
    })
    .onConflictDoUpdate({
      target: identityTable.worldId,
      set: {
        verificationLevel: "orb",
        isVerified: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  const identityId = identity.id;
  console.log(`  Identity: ${identity.username} (id=${identityId})`);

  await db
    .insert(credentialsTable)
    .values([
      { identityId, type: "orb", label: "Orb Verification", isActive: true },
      { identityId, type: "device", label: "Device Verification", isActive: true },
    ])
    .onConflictDoNothing();

  const tokenRows = [
    {
      identityId,
      symbol: "WLD",
      name: "Worldcoin",
      balance: "47.832",
      balanceUsd: "89.14",
      priceUsd: "1.862",
      change24hPercent: 5.23,
      chain: "worldchain",
    },
    {
      identityId,
      symbol: "USDC",
      name: "USD Coin",
      balance: "124.50",
      balanceUsd: "124.50",
      priceUsd: "1.00",
      change24hPercent: 0.01,
      chain: "worldchain",
    },
    {
      identityId,
      symbol: "ETH",
      name: "Ethereum",
      balance: "0.048521",
      balanceUsd: "131.23",
      priceUsd: "2704.50",
      change24hPercent: 2.87,
      chain: "worldchain",
    },
  ];

  for (const row of tokenRows) {
    await db
      .insert(tokensTable)
      .values(row)
      .onConflictDoUpdate({
        target: [tokensTable.identityId, tokensTable.symbol],
        set: {
          name: row.name,
          balance: row.balance,
          balanceUsd: row.balanceUsd,
          priceUsd: row.priceUsd,
          change24hPercent: row.change24hPercent,
          chain: row.chain,
          updatedAt: new Date(),
        },
      });
  }

  await db
    .execute(
      sql`UPDATE tokens SET identity_id = ${identityId} WHERE identity_id IS NULL`
    );

  const now = new Date();
  const day = (n: number) => new Date(now.getTime() - n * 86_400_000);

  await db
    .insert(transactionsTable)
    .values([
      {
        identityId,
        txId: "tx-001-send-wld",
        type: "send",
        status: "confirmed",
        amount: "5.5",
        amountUsd: "10.25",
        token: "WLD",
        fromAddress: "0x742d35Cc6634C0532925a3b8D4C9f5e7Aa5bFCe",
        toAddress: "0xCharlie0000000000000000000000000000000000",
        toUsername: "Charlie_x",
        txHash: "0xabc123",
        note: "Lunch split",
        createdAt: day(1),
      },
      {
        identityId,
        txId: "tx-002-receive-usdc",
        type: "receive",
        status: "confirmed",
        amount: "50.0",
        amountUsd: "50.00",
        token: "USDC",
        fromAddress: "0xBob0000000000000000000000000000000000000",
        toAddress: "0x742d35Cc6634C0532925a3b8D4C9f5e7Aa5bFCe",
        fromUsername: "Bob_world",
        txHash: "0xdef456",
        createdAt: day(2),
      },
      {
        identityId,
        txId: "tx-003-grant-wld",
        type: "grant",
        status: "confirmed",
        amount: "3.0",
        amountUsd: "5.59",
        token: "WLD",
        txHash: "0xghi789",
        note: "Grant: World ID Grant",
        createdAt: day(3),
      },
      {
        identityId,
        txId: "tx-004-send-usdc",
        type: "send",
        status: "confirmed",
        amount: "25.0",
        amountUsd: "25.00",
        token: "USDC",
        fromAddress: "0x742d35Cc6634C0532925a3b8D4C9f5e7Aa5bFCe",
        toAddress: "0xAlice000000000000000000000000000000000000",
        toUsername: "Alice_eth",
        txHash: "0xjkl012",
        note: "Coffee payment",
        createdAt: day(5),
      },
      {
        identityId,
        txId: "tx-005-receive-wld",
        type: "receive",
        status: "confirmed",
        amount: "10.0",
        amountUsd: "18.62",
        token: "WLD",
        fromAddress: "0xWorld0000000000000000000000000000000000",
        toAddress: "0x742d35Cc6634C0532925a3b8D4C9f5e7Aa5bFCe",
        fromUsername: "World_Foundation",
        txHash: "0xmno345",
        note: "Referral reward",
        createdAt: day(10),
      },
    ])
    .onConflictDoUpdate({
      target: transactionsTable.txId,
      set: { identityId },
    });

  await db
    .execute(
      sql`UPDATE transactions SET identity_id = ${identityId} WHERE identity_id IS NULL`
    );

  await db
    .insert(grantsTable)
    .values([
      {
        identityId,
        grantId: "grant-world-id-001",
        type: "world_id",
        title: "World ID Grant",
        description: "Monthly WLD grant for verified World ID holders",
        amountWld: "1.0",
        amountUsd: "1.86",
        status: "available",
        requiresOrb: false,
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
      },
      {
        identityId,
        grantId: "grant-orb-verified-001",
        type: "orb_verified",
        title: "Orb Verified Grant",
        description: "Exclusive grant for Orb-verified humans",
        amountWld: "5.0",
        amountUsd: "9.31",
        status: "available",
        requiresOrb: true,
        expiresAt: new Date(Date.now() + 14 * 86_400_000),
      },
      {
        identityId,
        grantId: "grant-claimed-001",
        type: "world_id",
        title: "Welcome Grant",
        description: "One-time onboarding grant",
        amountWld: "3.0",
        amountUsd: "5.59",
        status: "claimed",
        requiresOrb: false,
      },
    ])
    .onConflictDoUpdate({
      target: grantsTable.grantId,
      set: { identityId },
    });

  await db
    .execute(
      sql`UPDATE grants SET identity_id = ${identityId} WHERE identity_id IS NULL`
    );

  await db
    .insert(miniAppsTable)
    .values([
      {
        appId: "uniswap-world",
        name: "Uniswap",
        description: "Decentralized token exchange on World Chain",
        category: "defi",
        categoryLabel: "DeFi",
        developer: "Uniswap Labs",
        rating: 4.8,
        ratingCount: 12400,
        userCount: 89000,
        isVerified: true,
        isFeatured: true,
        tags: ["swap", "defi", "exchange"],
        url: "https://app.uniswap.org",
        screenshotUrls: [],
      },
      {
        appId: "worldchat",
        name: "WorldChat",
        description: "Verified human-to-human messaging",
        category: "social",
        categoryLabel: "Social",
        developer: "World Foundation",
        rating: 4.6,
        ratingCount: 8300,
        userCount: 210000,
        isVerified: true,
        isFeatured: true,
        tags: ["chat", "messaging", "social"],
        url: "https://chat.world.org",
        screenshotUrls: [],
      },
      {
        appId: "human-bound",
        name: "Human Bound",
        description: "Sybil-resistant DAO governance",
        category: "dao",
        categoryLabel: "DAO",
        developer: "HumanBound Team",
        rating: 4.3,
        ratingCount: 2100,
        userCount: 15000,
        isVerified: true,
        isFeatured: false,
        tags: ["dao", "governance", "voting"],
        url: "https://humanbound.xyz",
        screenshotUrls: [],
      },
    ])
    .onConflictDoNothing();

  console.log("Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
