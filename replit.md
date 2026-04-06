# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Full-stack World App — a web replication of the World (formerly Worldcoin) mobile app, featuring identity verification (World ID / Orb), a multi-token cryptocurrency wallet (WLD, USDC, ETH), transaction history, grants/rewards, and a mini-apps marketplace.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (react-vite artifact at `/`)
- **UI**: Tailwind CSS v4 + shadcn/ui components, Framer Motion animations, dark theme
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Architecture

```
artifacts/world-app/     # React + Vite frontend (previewPath: /)
artifacts/api-server/    # Express 5 API server (path: /api)
lib/api-spec/            # OpenAPI spec (source of truth)
lib/api-client-react/    # Generated React Query hooks
lib/api-zod/             # Generated Zod schemas for server validation
lib/db/                  # Drizzle ORM + PostgreSQL schema
```

## Key Features

- **Home Dashboard**: Total portfolio balance, token list, quick actions (Send/Receive/Swap), grants banner, recent transactions, global network stats
- **Wallet**: Token balances with 24h changes, send tokens (form with address/amount/token/note), receive with address copy
- **World ID**: Animated Orb visualization, verification level (None/Device/Orb), credential cards, nullifier hash display, verify CTA
- **Activity**: Transaction history with filters (All/Received/Sent/Grants), color-coded by type, transaction summary stats
- **Profile**: User card with verification badge, portfolio stats, settings menu

## API Endpoints

- `GET /api/identity` — User World ID and verification status
- `POST /api/identity/verify` — Initiate verification
- `GET /api/identity/credentials` — User credentials
- `GET /api/wallet` — Wallet overview with tokens
- `GET /api/wallet/tokens` — Token balances
- `POST /api/wallet/send` — Send tokens
- `GET /api/wallet/receive` — Receive address/QR info
- `GET /api/transactions` — Transaction history (paginated, filterable)
- `GET /api/transactions/summary` — Aggregate stats
- `GET /api/mini-apps` — Mini apps marketplace
- `GET /api/mini-apps/categories` — App categories
- `GET /api/mini-apps/:id` — App detail
- `POST /api/mini-apps/:id/launch` — Launch app
- `GET /api/grants` — Available grants
- `POST /api/grants/claim` — Claim a grant
- `GET /api/stats` — Global World network stats

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## DB Schema

- `identity` — User identity (world_id, username, verification_level, wallet_address)
- `credentials` — Verified credentials (orb, device, phone)
- `verification_sessions` — Orb/device verification sessions
- `tokens` — Token balances (WLD, USDC, ETH)
- `transactions` — Transaction history (send, receive, grant, swap)
- `mini_apps` — Mini apps marketplace
- `mini_app_launches` — App launch tracking
- `grants` — WLD grants and rewards

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
