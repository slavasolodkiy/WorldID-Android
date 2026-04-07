# World App — Web Foundation

A full-stack web application replicating the architecture and UX of the World (formerly Worldcoin) app. Built as a production-leaning learning foundation, **not** an official World/Worldcoin product.

## Platform Clarity

This is a **web application** (React + Vite frontend + Express API). The repository name "WorldID-Android" reflects its inspiration from the Android product, but the actual implementation is a browser-based progressive web app. See `docs/architecture.md` for the full technical platform story.

## Features

| Screen | Description |
|--------|-------------|
| **Home** | Portfolio balance, token list, grant banner, recent activity |
| **Wallet** | Send (validated + atomic), receive with QR, token balances |
| **World ID** | Animated Orb, verification level, credentials, verify CTA |
| **Activity** | Transaction history with type filters, aggregated stats |
| **Profile** | User info, wallet address, settings skeleton |

## Architecture

```
artifacts/world-app/     # React 19 + Vite 7 frontend  (path: /)
artifacts/api-server/    # Express 5 REST API           (path: /api)
lib/api-spec/            # OpenAPI 3.1 spec (source of truth)
lib/api-client-react/    # Generated React Query hooks (orval)
lib/api-zod/             # Generated Zod validation schemas (orval)
lib/db/                  # Drizzle ORM + PostgreSQL schema + seed
```

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm 10+
- PostgreSQL (auto-provisioned in Replit; use `DATABASE_URL` env var elsewhere)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Set environment variables (copy from example)
cp .env.example .env
# Edit .env with your DATABASE_URL and SESSION_SECRET

# 3. Push database schema
pnpm --filter @workspace/db run push-force

# 4. Seed the database
pnpm --filter @workspace/db run seed

# 5. Start the API server
pnpm --filter @workspace/api-server run dev

# 6. Start the frontend (separate terminal)
pnpm --filter @workspace/world-app run dev
```

### Running Tests

```bash
# Integration tests for the API
pnpm --filter @workspace/api-server run test

# Typecheck all packages
pnpm run typecheck
```

## API

All endpoints are prefixed with `/api`. See `lib/api-spec/openapi.yaml` for the full spec.

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/identity` | Current user identity |
| POST | `/api/identity/verify` | Initiate verification session |
| GET | `/api/wallet` | Wallet overview + token balances |
| POST | `/api/wallet/send` | Send tokens (validated + atomic) |
| GET | `/api/grants` | Available grants |
| POST | `/api/grants/claim` | Claim a grant (orb check + atomic) |
| GET | `/api/transactions` | Transaction history (paginated, filterable) |

## User Context

The API uses an `X-World-User-Id` header (worldId format) to resolve the current user. In development, if the header is absent, it falls back to the seeded user (`wld_1a2b3c4d5e6f7g8h9i0j`). See `docs/auth-session-model.md` for the full design.

## Seeded Data

The seed script creates one demo user:

- **Username**: `satoshi_w`
- **World ID**: `wld_1a2b3c4d5e6f7g8h9i0j`
- **Verification**: Orb-verified
- **Wallet**: `0x742d35Cc6634C0532925a3b8D4C9f5e7Aa5bFCe`
- **Tokens**: WLD (47.832), USDC (124.50), ETH (0.048521)
- **Grants**: 2 available (1 WLD, 5 WLD), 1 claimed

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — System design and boundaries
- [`docs/auth-session-model.md`](docs/auth-session-model.md) — Auth design and roadmap
- [`docs/transactions-and-grants.md`](docs/transactions-and-grants.md) — Business logic invariants
- [`docs/domain-model.md`](docs/domain-model.md) — Data model and relationships
- [`docs/reuse-readiness-report.md`](docs/reuse-readiness-report.md) — Before/after and next steps

## License

This is a learning/demonstration project. Not affiliated with Tools for Humanity or the World Foundation.
