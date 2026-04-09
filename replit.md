# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Full-stack World App — a web replication of the World (formerly Worldcoin) mobile app, featuring session-based authentication, identity verification (World ID / Orb), a multi-token cryptocurrency wallet (WLD, USDC, ETH), transaction history, grants/rewards, and a mini-apps marketplace.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (react-vite artifact at `/`)
- **UI**: Tailwind CSS v4 + shadcn/ui components, Framer Motion animations, dark theme
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (v3, not v4 subpath), `drizzle-zod`
- **Auth**: express-session with HttpOnly cookie (`world.sid`), SESSION_SECRET env var
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Architecture

```
artifacts/world-app/     # React + Vite frontend (previewPath: /)
artifacts/api-server/    # Express 5 API server (path: /api)
lib/api-spec/            # OpenAPI spec (source of truth)
lib/api-client-react/    # Generated React Query hooks + handwritten auth/verification hooks
lib/api-zod/             # Generated Zod schemas for server validation
lib/db/                  # Drizzle ORM + PostgreSQL schema
```

## Authentication Architecture

Session-based auth aligned with the Apple (WorldID-Apple) repository pattern:

### Backend (`artifacts/api-server/`)
- `express-session` stores session in PostgreSQL (connect-pg-simple)
- Cookie: `world.sid` (HttpOnly, SameSite=Lax)
- `SESSION_SECRET` env var required at startup
- Auth middleware (`src/middlewares/auth.ts`) resolution order:
  1. `req.session.userId` — set by `POST /api/auth/login`
  2. `X-World-User-Id` header — developer/test convenience
  3. No fallback — returns 401
- Routes: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/auth/me` returns `{ userId: null }` when not authenticated (no 401)

### Frontend (`artifacts/world-app/src/`)
- `contexts/auth.tsx` — `AuthProvider` + `useAuth()` hook
  - Calls `GET /api/auth/me` on mount to check session
  - Shows login screen when `userId === null`
  - Listens for global `auth:unauthorized` event (fired by `customFetch` on 401)
- `pages/login.tsx` — Login screen (username or worldId)
- `App.tsx` — `AuthGate` component: spinner → login → app
- `lib/api-client-react/src/custom-fetch.ts` — sends `credentials: 'include'`, fires `auth:unauthorized` event on 401
- `lib/api-client-react/src/handwritten.ts` — non-generated hooks: `useLogin`, `useLogout`, `useGetMe`, `useCompleteVerification`, `useGetVerificationSessions`

### Seeded Demo User
- username: `satoshi_w`
- worldId: `wld_1a2b3c4d5e6f7g8h9i0j`
- id: 1

## Key Features

- **Auth Gate**: Session-based login screen, global 401 handler, sign out
- **Home Dashboard**: Total portfolio balance, token list, quick actions (Send/Receive/Swap), grants banner, recent transactions, global network stats
- **Wallet**: Token balances with 24h changes, send tokens (form with address/amount/token/note, client-side idempotency key), receive with address copy. Error extraction via `ApiError.data.error`
- **World ID**: Animated Orb visualization, verification level (None/Device/Orb), credential cards, nullifier hash display, two-step verify CTA (initiate → complete), session list with status badges
- **Activity**: Transaction history with filters (All/Received/Sent/Grants), color-coded by type, transaction summary stats
- **Profile**: User card with verification badge, portfolio stats, settings menu, working Sign Out button

## API Endpoints

### Auth (no auth middleware required)
- `POST /api/auth/login` — create session by username or worldId
- `POST /api/auth/logout` — destroy session
- `GET /api/auth/me` — current session info (returns `{ userId: null }` if unauthenticated)

### Identity (requires auth)
- `GET /api/identity` — User World ID and verification status
- `POST /api/identity/verify` — Initiate verification session (dedup: returns existing pending)
- `POST /api/identity/verify/complete` — Complete verification atomically (idempotent)
- `GET /api/identity/verify/sessions` — List user's verification sessions
- `GET /api/identity/credentials` — User credentials

### Wallet (requires auth)
- `GET /api/wallet` — Wallet overview with tokens
- `GET /api/wallet/tokens` — Token balances
- `POST /api/wallet/send` — Send tokens (idempotency via `X-Idempotency-Key` header + unique DB column)
- `GET /api/wallet/receive` — Receive address/QR info
- `GET /api/transactions` — Transaction history (paginated, filterable)
- `GET /api/transactions/summary` — Aggregate stats

### Other (requires auth)
- `GET /api/mini-apps` — Mini apps marketplace
- `GET /api/mini-apps/categories` — App categories
- `GET /api/mini-apps/:id` — App detail
- `POST /api/mini-apps/:id/launch` — Launch app (user-scoped)
- `GET /api/grants` — Available grants
- `POST /api/grants/claim` — Claim a grant
- `GET /api/stats` — Global World network stats
- `GET /api/health` — Health check (public, no auth)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/api-server run test` — run integration tests (42 tests)

## DB Schema

- `identity` — User identity (world_id, username, verification_level, wallet_address, identity_id FK)
- `credentials` — Verified credentials (orb, device, phone)
- `verification_sessions` — Orb/device verification sessions
- `tokens` — Token balances (WLD, USDC, ETH)
- `transactions` — Transaction history (send, receive, grant, swap), with `idempotency_key` unique column
- `mini_apps` — Mini apps marketplace
- `mini_app_launches` — App launch tracking (user-scoped)
- `grants` — WLD grants and rewards

## Error Contracts

All API errors follow: `{ error: string, code: string }`. Frontend uses `ApiError.data.error` (not `.response.data.error`) to extract server messages.

## Notes

- `zod` v3 is installed — use `import { z } from "zod"` (not `"zod/v4"` subpath)
- Schema changes via raw SQL (`db.execute(sql\`ALTER TABLE...\`)`) — drizzle-kit push prompts interactively on unique constraint additions
- Integration tests use `X-World-User-Id: wld_1a2b3c4d5e6f7g8h9i0j` header for auth (second auth path still works)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
