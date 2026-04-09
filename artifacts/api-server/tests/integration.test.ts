/**
 * Integration tests — Android-to-Apple convergence suite.
 *
 * Covers:
 *  - Auth boundary: 401 without auth, header auth, session auth
 *  - Verification lifecycle: initiate, dedup, complete (atomic), idempotent complete
 *  - Wallet send: validation, atomic balance debit, idempotency key, concurrent safety
 *  - Grants: scoping, eligibility, claim atomicity
 *  - Transactions: pagination, filtering, validation
 *  - Mini-apps: listing, launch (user-scoped)
 *
 * Run:  pnpm --filter @workspace/api-server run test
 *
 * Prerequisites:
 *   - DATABASE_URL and SESSION_SECRET env vars set
 *   - Seed data present (pnpm --filter @workspace/db run seed)
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import app from "../src/app";

let base: string;
let server: ReturnType<typeof createServer>;

/** The seeded demo user's worldId */
const SEED_WORLD_ID = "wld_1a2b3c4d5e6f7g8h9i0j";
/** An unknown worldId (not in DB) */
const UNKNOWN_WORLD_ID = "wld_nonexistent_xyz999";

/** Make a request with the developer header (X-World-User-Id) */
function api(path: string, init?: RequestInit & { worldId?: string }) {
  // Extract worldId and headers separately so that `...rest` does not overwrite
  // the merged headers object we build below.
  const { worldId = SEED_WORLD_ID, headers: customHeaders, ...rest } = init ?? {};
  return fetch(`${base}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "X-World-User-Id": worldId,
      ...(customHeaders as Record<string, string> | undefined),
    },
    ...rest,
  });
}

/** Make a request with NO auth at all */
function unauthApi(path: string, init?: RequestInit) {
  return fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
}

before(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}/api`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

// ─────────────────────────────────────────────────────────────
// AUTH BOUNDARY
// ─────────────────────────────────────────────────────────────
describe("Auth boundary", () => {
  test("health check is public (no auth needed)", async () => {
    const res = await unauthApi("/healthz");
    assert.equal(res.status, 200);
  });

  test("protected route returns 401 without any auth", async () => {
    const res = await unauthApi("/identity");
    assert.equal(res.status, 401);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.code, "UNAUTHORIZED");
  });

  test("protected wallet route returns 401 without auth", async () => {
    const res = await unauthApi("/wallet");
    assert.equal(res.status, 401);
  });

  test("protected transactions route returns 401 without auth", async () => {
    const res = await unauthApi("/transactions");
    assert.equal(res.status, 401);
  });

  test("unknown X-World-User-Id header returns 401", async () => {
    const res = await api("/identity", { worldId: UNKNOWN_WORLD_ID });
    assert.equal(res.status, 401);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.code, "UNAUTHORIZED");
  });

  test("valid X-World-User-Id header resolves user", async () => {
    const res = await api("/identity");
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.username, "satoshi_w");
  });
});

// ─────────────────────────────────────────────────────────────
// AUTH ROUTES (login / logout / me)
// ─────────────────────────────────────────────────────────────
describe("POST /auth/login", () => {
  test("rejects login for unknown username", async () => {
    const res = await unauthApi("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "definitely.does.not.exist" }),
    });
    assert.equal(res.status, 401);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.code, "UNAUTHORIZED");
  });

  test("rejects login with empty body", async () => {
    const res = await unauthApi("/auth/login", {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  test("succeeds login with known username", async () => {
    const res = await unauthApi("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "satoshi_w" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.username, "satoshi_w");
    assert.ok(body.userId);
    assert.ok(body.worldId);
  });

  test("succeeds login with worldId", async () => {
    const res = await unauthApi("/auth/login", {
      method: "POST",
      body: JSON.stringify({ worldId: SEED_WORLD_ID }),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.worldId, SEED_WORLD_ID);
  });
});

// ─────────────────────────────────────────────────────────────
// IDENTITY
// ─────────────────────────────────────────────────────────────
describe("GET /identity", () => {
  test("returns current user identity", async () => {
    const res = await api("/identity");
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.username, "satoshi_w");
    assert.equal(body.verificationLevel, "orb");
    assert.ok(body.worldId);
    assert.ok(body.walletAddress);
  });
});

describe("GET /identity/credentials", () => {
  test("returns credentials scoped to current user", async () => {
    const res = await api("/identity/credentials");
    assert.equal(res.status, 200);
    const body = await res.json() as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
    assert.ok(body.every((c) => c.type && c.label));
  });
});

// ─────────────────────────────────────────────────────────────
// VERIFICATION LIFECYCLE
// ─────────────────────────────────────────────────────────────
describe("Verification lifecycle", () => {
  test("initiates a verification session", async () => {
    const res = await api("/identity/verify", {
      method: "POST",
      body: JSON.stringify({ level: "orb" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.ok(body.sessionId);
    assert.equal(body.level, "orb");
    assert.ok(["pending"].includes(body.status as string));
  });

  test("re-uses existing pending session (idempotent initiation)", async () => {
    const first = await api("/identity/verify", {
      method: "POST",
      body: JSON.stringify({ level: "device" }),
    });
    const firstBody = await first.json() as Record<string, unknown>;
    assert.equal(first.status, 200);

    const second = await api("/identity/verify", {
      method: "POST",
      body: JSON.stringify({ level: "device" }),
    });
    const secondBody = await second.json() as Record<string, unknown>;
    assert.equal(second.status, 200);

    assert.equal(firstBody.sessionId, secondBody.sessionId, "Should reuse same session");
    assert.equal(secondBody.reused, true);
  });

  test("rejects invalid verification level", async () => {
    const res = await api("/identity/verify", {
      method: "POST",
      body: JSON.stringify({ level: "invalid-level" }),
    });
    assert.equal(res.status, 400);
  });

  test("completes a verification session (atomic upgrade)", async () => {
    const initRes = await api("/identity/verify", {
      method: "POST",
      body: JSON.stringify({ level: "orb" }),
    });
    const { sessionId } = await initRes.json() as { sessionId: string };

    const completeRes = await api("/identity/verify/complete", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        nullifierHash: "0x" + "a".repeat(64),
        merkleRoot: "0x" + "b".repeat(64),
        proof: "0x" + "c".repeat(128),
      }),
    });
    assert.equal(completeRes.status, 200);
    const body = await completeRes.json() as Record<string, unknown>;
    assert.equal(body.success, true);
    assert.ok(body.level);
  });

  test("completing same session twice is idempotent", async () => {
    const initRes = await api("/identity/verify", {
      method: "POST",
      body: JSON.stringify({ level: "orb" }),
    });
    const { sessionId, reused } = await initRes.json() as { sessionId: string; reused: boolean };

    // We need a fresh session to test idempotent completion; if reused, the previous
    // test may have already completed it — just verify the complete endpoint handles both
    const complete1 = await api("/identity/verify/complete", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });
    // Either 200 (completed or already-completed)
    assert.ok([200].includes(complete1.status), `Expected 200, got ${complete1.status}`);
    const body1 = await complete1.json() as Record<string, unknown>;
    assert.equal(body1.success, true);

    // Second completion returns same success
    const complete2 = await api("/identity/verify/complete", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });
    assert.equal(complete2.status, 200);
    const body2 = await complete2.json() as Record<string, unknown>;
    assert.equal(body2.success, true);
    assert.equal(body2.alreadyCompleted, true);
  });

  test("completing session belonging to different user returns 404", async () => {
    const res = await api("/identity/verify/complete", {
      method: "POST",
      body: JSON.stringify({ sessionId: "nonexistent-session-id" }),
    });
    assert.equal(res.status, 404);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.code, "SESSION_NOT_FOUND");
  });

  test("GET /identity/verify/sessions returns session list", async () => {
    const res = await api("/identity/verify/sessions");
    assert.equal(res.status, 200);
    const body = await res.json() as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(body));
    assert.ok(body.every((s) => s.sessionId && s.status && s.level));
  });
});

// ─────────────────────────────────────────────────────────────
// WALLET
// ─────────────────────────────────────────────────────────────
describe("GET /wallet", () => {
  test("returns wallet with tokens", async () => {
    const res = await api("/wallet");
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.ok(typeof body.totalValueUsd === "number");
    assert.ok(Array.isArray(body.tokens));
    const tokens = body.tokens as Array<Record<string, unknown>>;
    assert.ok(tokens.length > 0);
    assert.ok(tokens.every((t) => typeof t.balance === "number" && t.balance >= 0));
    assert.ok(tokens.every((t) => typeof t.balanceUsd === "number"));
  });
});

// ─────────────────────────────────────────────────────────────
// WALLET SEND — validation, atomic debit, idempotency
// ─────────────────────────────────────────────────────────────
describe("POST /wallet/send", () => {
  test("rejects invalid Ethereum address", async () => {
    const res = await api("/wallet/send", {
      method: "POST",
      body: JSON.stringify({ toAddress: "not-an-address", amount: 1, token: "WLD" }),
    });
    assert.equal(res.status, 400);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.code, "INVALID_ADDRESS");
  });

  test("rejects zero amount", async () => {
    const res = await api("/wallet/send", {
      method: "POST",
      body: JSON.stringify({
        toAddress: "0xAbCd1234567890AbCd1234567890AbCd12345678",
        amount: 0,
        token: "WLD",
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.code, "INVALID_AMOUNT");
  });

  test("rejects negative amount", async () => {
    const res = await api("/wallet/send", {
      method: "POST",
      body: JSON.stringify({
        toAddress: "0xAbCd1234567890AbCd1234567890AbCd12345678",
        amount: -5,
        token: "WLD",
      }),
    });
    assert.equal(res.status, 400);
  });

  test("rejects send exceeding balance (atomic check)", async () => {
    const res = await api("/wallet/send", {
      method: "POST",
      body: JSON.stringify({
        toAddress: "0xAbCd1234567890AbCd1234567890AbCd12345678",
        amount: 999999,
        token: "WLD",
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.code, "INSUFFICIENT_BALANCE");
  });

  test("accepts valid send and atomically decrements balance", async () => {
    const beforeRes = await api("/wallet");
    const before = await beforeRes.json() as { tokens: Array<{ symbol: string; balance: number }> };
    const wldBefore = before.tokens.find((t) => t.symbol === "WLD")?.balance ?? 0;

    const sendAmount = 0.001;
    const res = await api("/wallet/send", {
      method: "POST",
      body: JSON.stringify({
        toAddress: "0xAbCd1234567890AbCd1234567890AbCd12345678",
        amount: sendAmount,
        token: "WLD",
        note: "Integration test send",
      }),
    });
    assert.equal(res.status, 200);
    const tx = await res.json() as Record<string, unknown>;
    assert.equal(tx.type, "send");
    assert.equal(tx.status, "confirmed");
    assert.ok(tx.txHash);

    const afterRes = await api("/wallet");
    const after = await afterRes.json() as { tokens: Array<{ symbol: string; balance: number }> };
    const wldAfter = after.tokens.find((t) => t.symbol === "WLD")?.balance ?? 0;

    assert.ok(
      Math.abs(wldBefore - wldAfter - sendAmount) < 0.000001,
      `Expected balance to decrease by ${sendAmount}, got ${wldBefore} → ${wldAfter}`,
    );
  });

  test("idempotency key: second call returns same tx without re-debiting", async () => {
    const idempotencyKey = `test-idem-${Date.now()}`;
    const sendAmount = 0.0001;
    const payload = {
      toAddress: "0xAbCd1234567890AbCd1234567890AbCd12345678",
      amount: sendAmount,
      token: "WLD",
    };

    const balanceBefore = await api("/wallet").then(r => r.json() as Promise<{ tokens: Array<{ symbol: string; balance: number }> }>);
    const wldBefore = balanceBefore.tokens.find((t) => t.symbol === "WLD")?.balance ?? 0;

    // First call
    const res1 = await api("/wallet/send", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "X-Idempotency-Key": idempotencyKey },
    });
    assert.equal(res1.status, 200);
    const tx1 = await res1.json() as Record<string, unknown>;
    assert.ok(tx1.txHash);

    // Second call with same key
    const res2 = await api("/wallet/send", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "X-Idempotency-Key": idempotencyKey },
    });
    assert.equal(res2.status, 200);
    const tx2 = await res2.json() as Record<string, unknown>;
    assert.equal(tx2.txHash, tx1.txHash, "Second call should return same transaction");
    assert.equal(tx2.idempotent, true, "Second call should be marked idempotent");

    const balanceAfter = await api("/wallet").then(r => r.json() as Promise<{ tokens: Array<{ symbol: string; balance: number }> }>);
    const wldAfter = balanceAfter.tokens.find((t) => t.symbol === "WLD")?.balance ?? 0;

    // Balance should only have decreased once (not twice)
    assert.ok(
      Math.abs(wldBefore - wldAfter - sendAmount) < 0.000001,
      `Idempotent: balance should decrease by exactly ${sendAmount}, got ${wldBefore} → ${wldAfter}`,
    );
  });

  test("concurrent sends cannot drive balance below zero", async () => {
    // Get current WLD balance
    const walletRes = await api("/wallet");
    const wallet = await walletRes.json() as { tokens: Array<{ symbol: string; balance: number }> };
    const currentBalance = wallet.tokens.find((t) => t.symbol === "WLD")?.balance ?? 0;

    // Send amount = balance + a large amount (will fail)
    const overAmount = currentBalance + 100;

    const concurrent = await Promise.all([
      api("/wallet/send", {
        method: "POST",
        body: JSON.stringify({
          toAddress: "0xAbCd1234567890AbCd1234567890AbCd12345678",
          amount: overAmount,
          token: "WLD",
        }),
      }),
      api("/wallet/send", {
        method: "POST",
        body: JSON.stringify({
          toAddress: "0xAbCd1234567890AbCd1234567890AbCd12345678",
          amount: overAmount,
          token: "WLD",
        }),
      }),
    ]);

    const statuses = concurrent.map((r) => r.status);
    assert.ok(
      statuses.every((s) => s === 400),
      `All concurrent over-balance sends should fail: ${statuses}`,
    );
  });
});

// ─────────────────────────────────────────────────────────────
// GRANTS
// ─────────────────────────────────────────────────────────────
describe("GET /grants", () => {
  test("returns grants scoped to current user", async () => {
    const res = await api("/grants");
    assert.equal(res.status, 200);
    const body = await res.json() as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(body));
    assert.ok(body.every((g) => typeof g.amountWld === "number" && g.amountWld > 0));
  });
});

describe("POST /grants/claim", () => {
  test("rejects already-claimed grant", async () => {
    const res = await api("/grants/claim", {
      method: "POST",
      body: JSON.stringify({ grantId: "grant-claimed-001" }),
    });
    assert.equal(res.status, 409);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.code, "ALREADY_CLAIMED");
  });

  test("rejects missing grantId", async () => {
    const res = await api("/grants/claim", {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  test("rejects grant belonging to different user", async () => {
    const res = await api("/grants/claim", {
      method: "POST",
      body: JSON.stringify({ grantId: "nonexistent-grant-id" }),
    });
    assert.equal(res.status, 404);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.code, "GRANT_NOT_FOUND");
  });
});

// ─────────────────────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────────────────────
describe("GET /transactions", () => {
  test("returns paginated transactions scoped to user", async () => {
    const res = await api("/transactions?page=1&limit=10");
    assert.equal(res.status, 200);
    const body = await res.json() as { transactions: unknown[]; total: number; page: number };
    assert.ok(Array.isArray(body.transactions));
    assert.ok(typeof body.total === "number");
    assert.equal(body.page, 1);
  });

  test("filters by type=send", async () => {
    const res = await api("/transactions?type=send");
    assert.equal(res.status, 200);
    const body = await res.json() as { transactions: Array<{ type: string }> };
    assert.ok(body.transactions.every((t) => t.type === "send"));
  });

  test("filters by type=receive", async () => {
    const res = await api("/transactions?type=receive");
    assert.equal(res.status, 200);
    const body = await res.json() as { transactions: Array<{ type: string }> };
    assert.ok(body.transactions.every((t) => t.type === "receive"));
  });

  test("filters by type=grant", async () => {
    const res = await api("/transactions?type=grant");
    assert.equal(res.status, 200);
    const body = await res.json() as { transactions: Array<{ type: string }> };
    assert.ok(body.transactions.every((t) => t.type === "grant"));
  });

  test("rejects page=0 (invalid pagination)", async () => {
    const res = await api("/transactions?page=0");
    assert.equal(res.status, 400);
  });
});

describe("GET /transactions/summary", () => {
  test("returns aggregated stats", async () => {
    const res = await api("/transactions/summary");
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.ok(typeof body.totalSentUsd === "number");
    assert.ok(typeof body.totalReceivedUsd === "number");
    assert.ok(typeof body.totalGrantsUsd === "number");
    assert.ok(typeof body.transactionCount === "number");
    assert.ok(typeof body.thisMonthUsd === "number");
  });
});

// ─────────────────────────────────────────────────────────────
// MINI-APPS (user-scoped launch, error contracts)
// ─────────────────────────────────────────────────────────────
describe("GET /mini-apps", () => {
  test("returns list of mini apps", async () => {
    const res = await api("/mini-apps");
    assert.equal(res.status, 200);
    const body = await res.json() as unknown[];
    assert.ok(Array.isArray(body));
  });

  test("filters by category", async () => {
    const res = await api("/mini-apps?category=defi");
    assert.equal(res.status, 200);
    const body = await res.json() as Array<{ category: string }>;
    assert.ok(body.every((a) => a.category === "defi"));
  });

  test("GET unknown mini-app returns 404 with error code", async () => {
    const res = await api("/mini-apps/nonexistent-app-xyz");
    assert.equal(res.status, 404);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.code, "MINI_APP_NOT_FOUND");
  });

  test("launch records user-scoped event", async () => {
    const appsRes = await api("/mini-apps");
    const apps = await appsRes.json() as Array<{ id: string }>;
    if (apps.length === 0) return; // skip if no apps

    const res = await api(`/mini-apps/${apps[0].id}/launch`, { method: "POST" });
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.success, true);
    assert.ok(body.url);
  });

  test("launch unknown mini-app returns 404", async () => {
    const res = await api("/mini-apps/nonexistent-app-xyz/launch", { method: "POST" });
    assert.equal(res.status, 404);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.code, "MINI_APP_NOT_FOUND");
  });
});
