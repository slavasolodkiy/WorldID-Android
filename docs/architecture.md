# Architecture

## Overview

World App Foundation is a **web application** — React + Vite frontend + Express API + PostgreSQL DB. It is not a native Android app; the name "WorldID-Android" reflects the product inspiration, not the implementation.

## System Boundaries

```
Browser (mobile-first PWA)
  └─ React + Vite (port $PORT / path /)
       └─ React Query hooks (lib/api-client-react)
            └─ HTTP → Express API (port $PORT / path /api)
                  ├─ resolveUser middleware   ← user context
                  ├─ errorHandler middleware  ← consistent error contract
                  ├─ Identity routes          ← /api/identity
                  ├─ Wallet routes            ← /api/wallet
                  ├─ Grants routes            ← /api/grants
                  ├─ Transaction routes       ← /api/transactions
                  ├─ Mini-apps routes         ← /api/mini-apps
                  └─ Stats routes             ← /api/stats
                        └─ Drizzle ORM
                              └─ PostgreSQL
```

## Package Structure (pnpm workspace)

| Package | Role |
|---------|------|
| `artifacts/world-app` | React 19 + Vite 7 frontend |
| `artifacts/api-server` | Express 5 REST API backend |
| `lib/api-spec` | OpenAPI 3.1 spec (single source of truth) |
| `lib/api-client-react` | Generated React Query hooks (orval → from spec) |
| `lib/api-zod` | Generated Zod validation schemas (orval → from spec) |
| `lib/db` | Drizzle ORM schema, seed, DB connection |

## Request Flow

1. Browser → React Query hook → `fetch /api/...`
2. Express receives request → `pino-http` logs it
3. `resolveUser` middleware reads `X-World-User-Id` header (or falls back to dev seed user) → attaches `req.currentUser`
4. Route handler calls service method with `req.currentUser.id`
5. Service performs business logic (validation, atomicity, invariant checks) using Drizzle
6. Route handler serializes response (parsing numeric strings → numbers)
7. `errorHandler` catches any thrown `AppError` → consistent `{ error, code }` JSON

## Data Flow for Send

```
POST /api/wallet/send
  → resolveUser (lookup current user by worldId header)
  → SendTokensBody.safeParse(req.body)   [Zod validation]
  → WalletService.send(...)
      → ETH address regex check
      → amount > 0 check
      → token balance lookup (for user)
      → insufficient balance check
      → db.transaction(() => {
            UPDATE tokens SET balance = balance - amount
            INSERT INTO transactions ...
         })
  → 200 { id, type, status, amount, ... }
```

## Monorepo Conventions

- All packages use `type: "module"` (ESM)
- TypeScript strict mode throughout
- Shared dependencies declared in `pnpm-workspace.yaml` `catalog`
- `lib/` packages are consumed via workspace references (`workspace:*`)
- Schema changes: edit `lib/db/src/schema/*.ts` → `push-force` → `seed`
- API changes: edit `lib/api-spec/openapi.yaml` → `codegen` → implement route + service

## Known Limitations / Not-Yet-Real

- No real World ID proof verification (sessions are mocked)
- No real blockchain transaction submission (txHash is random)
- No real price feeds (24h change is hardcoded 3.2%)
- Auth is header-based with no cryptographic verification
- No swap implementation
- No WebSocket / real-time updates
- No push notifications
