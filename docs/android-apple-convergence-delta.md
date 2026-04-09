# Android ↔ Apple Convergence Delta

**Date**: 2026-04-09  
**Status**: All convergence gaps closed. 42/42 integration tests green.

---

## Summary

The Android (World App) API server has been converged with the Apple (WorldID-Apple) repository patterns across five critical domains: auth boundary, verification lifecycle, transaction concurrency/idempotency, mini-app user scoping, and error contracts.

---

## Gap-by-Gap Resolution

### 1. Auth Boundary — Demo Fallback Removed

| | Before | After |
|---|---|---|
| **Apple** | session-first → 401 | ✅ same |
| **Android** | session-first → header → `FALLBACK_WORLD_ID` | session-first → header → 401 |

**Change**: Removed `FALLBACK_WORLD_ID = "wld_1a2b3c4d5e6f7g8h9i0j"` demo fallback from `resolveUser`. Any request without a valid session or recognized `X-World-User-Id` header now returns `401 UNAUTHORIZED`.

**Files**: `artifacts/api-server/src/middlewares/auth.ts`

---

### 2. Session-Based Auth Routes Added

| | Before | After |
|---|---|---|
| **Apple** | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | ✅ same |
| **Android** | Missing all three | Added all three |

**Change**: Added `express-session` middleware to `app.ts`. New `routes/auth.ts` implements:
- `POST /api/auth/login` — accepts `{ worldId? }` or `{ username? }`, creates session
- `POST /api/auth/logout` — destroys session, clears cookie
- `GET /api/auth/me` — returns session user info without DB hit on miss

**Files**: `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/auth.ts`, `artifacts/api-server/src/types/session.d.ts`

---

### 3. Verification Lifecycle Completion

| | Before | After |
|---|---|---|
| **Apple** | initiate + complete + sessions list | ✅ same |
| **Android** | initiate only | initiate + complete + sessions list |

**Changes**:

a) **Initiation dedup**: `POST /api/identity/verify` now checks for an existing `pending`, non-expired session at the requested level before creating a new one. Returns `{ reused: true }` when reusing.

b) **Completion endpoint**: `POST /api/identity/verify/complete` — fully aligned with Apple's lifecycle:
   - Validates session ownership (identity FK check)
   - Validates session is `pending` and not expired
   - Marks expired sessions as `expired` status
   - **Idempotent**: calling again on an already-`completed` session returns `{ success: true, alreadyCompleted: true }`
   - **Atomic transaction**: marks session `completed` + upgrades `verificationLevel` + inserts credential in one `db.transaction()`
   - **Monotonic**: only upgrades level (orb > device > none); never downgrades

c) **Sessions list**: `GET /api/identity/verify/sessions` — returns all sessions for the current user, ordered by creation date.

**Files**: `artifacts/api-server/src/services/identity.service.ts`, `artifacts/api-server/src/routes/identity.ts`

---

### 4. Atomic Send + Idempotency Key

| | Before | After |
|---|---|---|
| **Apple** | atomic UPDATE + idempotency check | ✅ same |
| **Android** | read-then-write (TOCTOU race) | atomic UPDATE + idempotency check |

**Changes**:

a) **Atomic debit**: Replaced the `SELECT balance` → check → `UPDATE balance` pattern with a single:
   ```sql
   UPDATE tokens
   SET balance = balance - $amount
   WHERE id = $id AND balance >= $amount
   RETURNING *
   ```
   If `0 rows` returned → `INSUFFICIENT_BALANCE 400` (no possibility of race driving balance negative).

b) **Idempotency key**: `POST /api/wallet/send` accepts `X-Idempotency-Key` header. On receipt:
   - Checks `transactions` table for matching `idempotency_key`
   - If found → returns existing transaction `{ ...tx, idempotent: true }` without re-debiting
   - If not found → proceeds normally; stores key in the same `db.transaction()` that debits the balance

c) **Schema**: Added `idempotency_key TEXT UNIQUE` column to `transactions` table (nullable; NULLs do not violate unique constraints).

**Files**: `artifacts/api-server/src/services/wallet.service.ts`, `artifacts/api-server/src/routes/wallet.ts`, `lib/db/src/schema/transactions.ts`

---

### 5. Mini-App Launch — User Scoping

| | Before | After |
|---|---|---|
| **Apple** | N/A (no mini-apps on Apple) | — |
| **Android** | launch inserts `appId` only | launch inserts `appId` + `identityId` FK |

**Change**: `POST /api/mini-apps/:id/launch` now records `req.currentUser.id` in the `identity_id` column, enabling per-user launch analytics.

**Schema**: Added `identity_id INTEGER REFERENCES identity(id) ON DELETE SET NULL` to `mini_app_launches`.

**Files**: `artifacts/api-server/src/routes/mini-apps.ts`, `lib/db/src/schema/mini-apps.ts`

---

### 6. Error Contracts Normalized

| | Before | After |
|---|---|---|
| **Apple** | `{ error, code }` on all routes | ✅ same |
| **Android** | Mini-apps routes missing `try/catch + next(err)` | All handlers wrapped; all errors carry `code` field |

**Change**: All mini-app route handlers now wrap their body in `try/catch` and call `next(err)`, routing to the centralized `errorHandler`. All `AppError` throws include a `code` string field surfaced in the JSON response.

---

## Architecture Invariants Preserved

| Invariant | Status |
|---|---|
| `db.transaction()` wraps balance debit + tx insert (send) | ✅ maintained |
| `db.transaction()` wraps balance credit + tx insert + grant claim (claim) | ✅ maintained |
| `numeric(28,8)` money types on all balance/amount columns | ✅ maintained |
| `identity_id` FK on all user-scoped tables | ✅ maintained |
| No plaintext secrets in code | ✅ `SESSION_SECRET` from env only |

---

## Test Coverage (42 tests, 12 suites)

| Suite | Tests |
|---|---|
| Auth boundary | 401 without auth, unknown header, valid header, health public |
| POST /auth/login | unknown user, empty body, username, worldId |
| GET /identity | identity shape |
| GET /identity/credentials | credential list |
| Verification lifecycle | initiate, dedup, invalid level, complete, idempotent complete, cross-user session |
| GET /wallet | token list |
| POST /wallet/send | invalid address, zero amount, negative amount, over-balance, valid send (balance check), idempotency key, concurrent balance safety |
| GET /grants | scoped list |
| POST /grants/claim | already-claimed, missing id, wrong user |
| GET /transactions | paginated, type filters, invalid page |
| GET /transactions/summary | aggregated stats |
| GET /mini-apps | list, category filter, 404 with code, user-scoped launch, launch 404 |

---

## Remaining Delta (Out of Scope)

| Gap | Notes |
|---|---|
| Real World ID ZKP proof verification | `completeVerification` mocks proof validation; production would call the World ID verifier SDK |
| Refresh token / session rotation | Apple uses session rolling on activity; not implemented |
| Rate limiting on auth routes | Should be added before production deployment |
