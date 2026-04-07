/**
 * Integration tests for critical API paths.
 *
 * Uses Node.js built-in test runner (node:test) + native fetch.
 * Run:  pnpm --filter @workspace/api-server run test
 *
 * Prerequisites:
 *   - DATABASE_URL env var set (same as the app)
 *   - Seed data present (run `pnpm --filter @workspace/db run seed` first)
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import app from "../src/app";

let base: string;
let server: ReturnType<typeof createServer>;

function api(path: string, init?: RequestInit) {
  return fetch(`${base}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
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

describe("GET /api/identity", () => {
  test("returns current user identity", async () => {
    const res = await api("/identity");
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.username, "satoshi_w");
    assert.equal(body.verificationLevel, "orb");
    assert.ok(body.worldId);
    assert.ok(body.walletAddress);
  });

  test("returns 401 for unknown X-World-User-Id header", async () => {
    const res = await api("/identity", {
      headers: { "X-World-User-Id": "wld_nonexistent_user" },
    });
    assert.equal(res.status, 401);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.code, "UNAUTHORIZED");
  });
});

describe("GET /api/identity/credentials", () => {
  test("returns credentials scoped to current user", async () => {
    const res = await api("/identity/credentials");
    assert.equal(res.status, 200);
    const body = await res.json() as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
    assert.ok(body.every((c) => c.type && c.label));
  });
});

describe("GET /api/wallet", () => {
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

describe("POST /api/wallet/send", () => {
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

  test("rejects send exceeding balance", async () => {
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

  test("accepts valid send and decrements balance", async () => {
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
});

describe("GET /api/grants", () => {
  test("returns grants scoped to current user", async () => {
    const res = await api("/grants");
    assert.equal(res.status, 200);
    const body = await res.json() as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
    assert.ok(body.every((g) => typeof g.amountWld === "number" && g.amountWld > 0));
  });
});

describe("POST /api/grants/claim", () => {
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

  test("rejects grant belonging to a different user", async () => {
    const res = await api("/grants/claim", {
      method: "POST",
      body: JSON.stringify({ grantId: "nonexistent-grant-id" }),
    });
    assert.equal(res.status, 404);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.code, "GRANT_NOT_FOUND");
  });
});

describe("GET /api/transactions", () => {
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

  test("rejects invalid query params", async () => {
    const res = await api("/transactions?page=0");
    assert.equal(res.status, 400);
  });
});

describe("GET /api/transactions/summary", () => {
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

describe("GET /api/mini-apps", () => {
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
});
