# AGENTS.md — Agent Guidance for World App Foundation

This file documents conventions, invariants, and important context for AI coding agents working in this repository.

## Repository Identity

This is a **web application** (not native Android), inspired by the World (Worldcoin) Android app. The name "WorldID-Android" reflects the product inspiration, not the implementation platform. Agents should not add Android/Kotlin/Java code.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 7 + Tailwind CSS v4 |
| Backend | Express 5 + Node.js 24 (ESM) |
| Database | PostgreSQL + Drizzle ORM |
| Monorepo | pnpm workspaces |
| API contract | OpenAPI 3.1 spec → orval codegen |

## Key Invariants — Do Not Break

1. **User scoping**: Every data access must use `req.currentUser.id` (set by `resolveUser` middleware). Never use `LIMIT 1` to pick a user.

2. **Money precision**: Token amounts → `numeric(28,8)`. USD values → `numeric(18,6)`. Never use `real`/`float` for financial values. Parse numeric strings with `parseFloat()` in service layers.

3. **Wallet send is atomic**: The `db.transaction()` in `WalletService.send()` must update balance AND insert transaction together. Never split these.

4. **Grant claim is atomic**: Same principle — grant status update, balance increment, transaction insert are one DB transaction in `GrantsService.claim()`.

5. **Address validation**: Ethereum addresses must match `/^0x[0-9a-fA-F]{40}$/` before any send operation.

6. **Error contracts**: All API errors return `{ error: string, code: string }`. The `AppError` class sets the `code`. Use it instead of raw `res.status(x).json()`.

7. **Preserve route map**: Do not change URL paths in `artifacts/api-server/src/routes/index.ts` without also updating the OpenAPI spec and regenerating the client.

## Workflow

### Schema changes
1. Edit `lib/db/src/schema/*.ts`
2. Run `pnpm --filter @workspace/db run push-force`
3. Run `pnpm --filter @workspace/db run seed` (idempotent)
4. Update affected services in `artifacts/api-server/src/services/`

### Adding an API endpoint
1. Add to `lib/api-spec/openapi.yaml`
2. Run `pnpm --filter @workspace/api-spec run codegen`
3. Implement route in `artifacts/api-server/src/routes/`
4. Add service logic in `artifacts/api-server/src/services/`
5. Add integration tests in `artifacts/api-server/tests/`

### Running integration tests
```bash
pnpm --filter @workspace/api-server run test
```
Tests require the seed data to be present. Run seed first if starting fresh.

## Mocked / Stubbed Flows

Be explicit about what is NOT real:

- **Wallet 24h change**: Hardcoded `3.2%` in `WalletService.getWallet()`. Not from a real price feed.
- **QR code**: SVG approximation, not a real QR code library.
- **Mini-app launch**: Records a launch event but does not actually open an iframe/webview.
- **Swap**: UI button exists but no route or logic. Returns 404 if called.
- **Verification sessions**: Creates a DB record but does not call any real World ID verification service.
- **Auth**: `X-World-User-Id` header is not cryptographically verified. Replace with JWT validation before production use.

## Testing Approach

- Tests are in `artifacts/api-server/tests/integration.test.ts`
- Uses Node.js built-in `node:test` runner + native `fetch`
- Tests start the Express app on a random port, no mocking of the DB
- Requires `DATABASE_URL` and seeded data

## Files to Know

```
artifacts/api-server/src/
  middlewares/auth.ts        # resolveUser — user context
  middlewares/error.ts       # AppError + errorHandler
  services/wallet.service.ts # Atomic send logic
  services/grants.service.ts # Atomic claim logic, orb check
  services/identity.service.ts

lib/db/src/
  schema/identity.ts         # identityTable, credentialsTable
  schema/wallet.ts           # tokensTable (numeric amounts, identityId FK)
  schema/transactions.ts     # transactionsTable (numeric amounts, identityId FK)
  schema/grants.ts           # grantsTable (numeric amounts, identityId FK)
  seed.ts                    # Idempotent seed (upsert)
```

## Do Not

- Add `LIMIT 1` to any user data query
- Use `real` / `float` for monetary values
- Split a send or claim into separate DB statements (no atomicity)
- Expose raw DB errors to API clients (use AppError)
- Store secrets in source code (use environment variables)
- Present this as an official World/Worldcoin product
