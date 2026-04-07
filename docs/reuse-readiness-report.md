# Reuse Readiness Report

## Before vs. After

### Before (baseline)

| Concern | State |
|---------|-------|
| User model | Single-user: every query used `LIMIT 1` to grab first identity row |
| Money types | `real` (float32) — accumulates rounding errors |
| FK constraints | `identity_id` in credentials/sessions was `serial`, not a real FK |
| Other tables | `tokens`, `transactions`, `grants` had no user ownership column |
| Send validation | No address validation, no balance check, no atomicity |
| Grant claim | No orb-verification check, no balance update, no atomicity |
| Error handling | Ad-hoc `res.status(x).json()` in each route, no consistent contract |
| Service layer | None — all business logic inline in route handlers |
| Auth | None — hardcoded to first DB row |
| Tests | None |
| Frontend errors | Loading skeletons present, but no `isError` handling or retry buttons |
| Seed | One-off script, not idempotent |
| Docs | None |

### After (this upgrade)

| Concern | State |
|---------|-------|
| User model | `resolveUser` middleware resolves `X-World-User-Id` → `req.currentUser`; all queries scoped by `identityId` |
| Money types | `numeric(28,8)` / `numeric(18,6)` for all financial fields |
| FK constraints | Proper `integer references identity(id)` on all child tables |
| Other tables | `tokens`, `transactions`, `grants` all carry `identity_id` FK |
| Send validation | ETH address regex, amount > 0, balance check, atomic DB transaction |
| Grant claim | Orb check, expiry check, status check, atomic DB transaction (balance update + tx insert) |
| Error handling | `AppError` class + `errorHandler` middleware → `{ error, code }` contract on all routes |
| Service layer | `IdentityService`, `WalletService`, `GrantsService` — routes are thin |
| Auth | Header-based user resolution (documented upgrade path to JWT) |
| Tests | Integration tests covering identity, wallet send (6 cases), grants (3 cases), transactions (5 cases), mini-apps |
| Frontend errors | `isError` + retry buttons on Home, Wallet, Activity, Identity; send form inline error messages |
| Seed | Idempotent (upsert), deterministic, backfills `identity_id` on existing rows |
| Docs | README, AGENTS.md, docs/architecture.md, docs/auth-session-model.md, docs/transactions-and-grants.md, docs/domain-model.md |

---

## Critical Blockers Still Remaining

These must be addressed before this can be considered production-ready:

### P0 — Security

1. **No cryptographic auth**: The `X-World-User-Id` header is not signed/verified. Any caller can impersonate any user. Must be replaced with JWT or a real session token before any public deployment.

2. **No rate limiting**: The `/api/wallet/send` and `/api/grants/claim` endpoints have no rate limiting. A malicious client could flood the DB.

3. **No CSRF protection**: Cookie-based sessions (if added) need CSRF tokens for browser clients.

### P1 — Correctness

4. **`receive` transactions don't update balance**: When external receives are created (currently only via seed), the recipient's token balance is not automatically incremented. The flow is asymmetric with `send`.

5. **Swap not implemented**: The Swap button in the UI navigates to the wallet but there's no `/api/wallet/swap` endpoint or UI flow.

6. **Price feed is hardcoded**: Token prices and 24h changes are static seed data. Balances become stale immediately after a send.

### P2 — Reliability

7. **No idempotency key storage**: The API accepts a unique `txId` per transaction, but there's no mechanism to detect and reject duplicate requests (e.g., from network retries). Add a `txId`-based idempotency check before inserting.

8. **No DB connection pool tuning**: The pool uses defaults. Under concurrent load, connections can be exhausted.

9. **No healthcheck for DB**: `GET /api/health` exists but doesn't verify DB connectivity.

### P3 — Completeness

10. **Mini-app launches not user-scoped**: `miniAppLaunchesTable` has no `identityId` column — launches are anonymous.

11. **Profile page is static**: Settings items are non-functional buttons.

12. **No pagination on mini-apps**: Returns all mini-apps without cursor/page support.

---

## Readiness Delta

| Dimension | Before | After | Target (prod) |
|-----------|--------|-------|---------------|
| User isolation | 0% | 80% | 100% |
| Financial correctness | 30% | 75% | 95% |
| Auth strength | 0% | 20% | 90% |
| Test coverage (API) | 0% | ~60% | 80% |
| Error UX | 20% | 70% | 90% |
| Documentation | 0% | 80% | 85% |

---

## Next Best Prompt

> You are working in the WorldID-Android repository. `docs/reuse-readiness-report.md` lists the remaining blockers.
>
> Implement the following in order of priority:
> 1. Replace the `X-World-User-Id` header auth with JWT verification using the `SESSION_SECRET` env var. Add a `POST /api/auth/login` endpoint that accepts `worldId` + issues a signed JWT. Update `resolveUser` to verify the JWT. Remove the dev fallback.
> 2. Add rate limiting to `/api/wallet/send` and `/api/grants/claim` (max 10 req/min per user) using an in-memory sliding window (no new packages — use a Map<userId, timestamps[]>).
> 3. Add `identityId` FK to `miniAppLaunchesTable` and scope mini-app launch tracking to the user.
> 4. Implement the `receive` transaction balance update: when a `type=receive` transaction is inserted, atomically increment the recipient's token balance.
> 5. Add an idempotency guard to `POST /api/wallet/send`: accept an `X-Idempotency-Key` header, store it with the transaction, and return the same response for duplicate requests.
>
> Constraints: preserve route map, no UI redesign, no unnecessary new packages.
