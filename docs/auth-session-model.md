# Auth / Session Model

## Current Implementation

This is a **development-grade header-based auth** model, not a production authentication system. It was designed to replace the hardcoded single-user assumption while deferring full auth implementation.

### How It Works

1. The `resolveUser` middleware (`artifacts/api-server/src/middlewares/auth.ts`) runs on every `/api/*` request.

2. It reads the `X-World-User-Id` header — expected to contain a `worldId` string (e.g. `wld_1a2b3c4d5e6f7g8h9i0j`).

3. It looks up the `identityTable` row matching that `worldId`.

4. If found → attaches `req.currentUser` (the full Identity row) and calls `next()`.

5. If the header is explicitly provided but the user does not exist → `401 UNAUTHORIZED`.

6. If the header is **absent** → falls back to the seeded demo user (`wld_1a2b3c4d5e6f7g8h9i0j`). This is a development convenience — in production this fallback must be removed.

### What This Replaces

Before this middleware, every route handler did:

```typescript
const [identity] = await db.select().from(identityTable).limit(1);
```

This is the "single-user assumption" — it always returns the first row regardless of who the caller is. This is now replaced by proper user-scoped lookups.

## Production Upgrade Path

To upgrade to production-grade auth:

### Option A: JWT (Recommended)

1. Issue a signed JWT at login containing `{ sub: worldId, iat, exp }`.
2. Client sends `Authorization: Bearer <token>` header.
3. Middleware verifies the JWT signature with the server's `SESSION_SECRET`.
4. Extract `worldId` from the verified token payload.
5. Look up the user (same DB query as today).

```typescript
// Pseudocode for JWT upgrade
const token = req.headers["authorization"]?.replace("Bearer ", "");
const payload = jwt.verify(token, process.env.SESSION_SECRET);
const worldId = payload.sub;
```

### Option B: World ID SDK

The real World app verifies users via zero-knowledge proofs through the World ID SDK. This requires:

1. Frontend sends a World ID proof to the API.
2. Backend verifies the proof with the World ID cloud verifier.
3. On success, extract the nullifier hash, look up or create the identity, issue a session token.

See [https://docs.worldcoin.org](https://docs.worldcoin.org) for the real SDK integration.

### Option C: express-session + cookie

Use `express-session` with a secure, httpOnly cookie. The session store holds `{ worldId }`. `SESSION_SECRET` is already in the environment.

## Invariants

- All routes are protected — there is no "public" endpoint that bypasses `resolveUser`.
- `req.currentUser` is always set before any route handler runs.
- User data is always scoped by `req.currentUser.id` — never by `LIMIT 1`.

## Stubbed / Mocked Auth Flows

- **Verification sessions** (`POST /api/identity/verify`): Creates a DB session record but does not call any real World ID verification service. In production this would redirect to the World ID web widget or mobile app.
