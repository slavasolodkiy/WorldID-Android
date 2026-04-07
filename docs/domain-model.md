# Domain Model

## Entity Relationships

```
identity (1)
  ├── credentials (N)        — orb, device, phone credentials
  ├── verification_sessions (N) — pending/completed verification attempts
  ├── tokens (N)             — WLD, USDC, ETH balances
  ├── transactions (N)       — send, receive, grant, swap history
  └── grants (N)             — WLD grant offers
```

All child tables hold an `identity_id` FK with `ON DELETE CASCADE` (tokens, grants) or `ON DELETE SET NULL` (transactions, for audit trail preservation).

## Entities

### `identity`
The central entity representing a user. Has exactly one wallet address.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | Internal ID |
| `world_id` | text unique | `wld_...` format — the World ID identifier |
| `username` | text unique | Display name |
| `verification_level` | text | `none` \| `device` \| `orb` |
| `is_verified` | boolean | Quick flag |
| `nullifier_hash` | text | ZK proof nullifier |
| `wallet_address` | text | Ethereum address |
| `joined_at` | timestamptz | Immutable join date |

### `credentials`
Verified credentials issued to a user.

| Column | Type | Notes |
|--------|------|-------|
| `identity_id` | integer FK → identity.id | |
| `type` | text | `orb` \| `device` \| `phone` |
| `label` | text | Human-readable label |
| `issued_at` | timestamptz | |
| `expires_at` | timestamptz nullable | |
| `is_active` | boolean | |

### `verification_sessions`
Tracks in-progress verification attempts.

| Column | Type | Notes |
|--------|------|-------|
| `session_id` | text unique | UUID |
| `identity_id` | integer FK → identity.id | |
| `status` | text | `pending` \| `completed` \| `expired` |
| `level` | text | `device` \| `orb` |
| `expires_at` | timestamptz | 24h from creation |

### `tokens`
Per-user token balances. One row per (user, token symbol).

| Column | Type | Notes |
|--------|------|-------|
| `identity_id` | integer FK → identity.id | CASCADE delete |
| `symbol` | text | WLD, USDC, ETH |
| `balance` | numeric(28,8) | Token units |
| `balance_usd` | numeric(18,6) | Denormalized USD equivalent |
| `price_usd` | numeric(18,6) | Snapshot price |
| `change_24h_percent` | real | Display only (not financial) |

### `transactions`
Immutable audit log of all financial activity.

| Column | Type | Notes |
|--------|------|-------|
| `identity_id` | integer FK → identity.id | SET NULL on delete |
| `tx_id` | text unique | UUID, idempotency key |
| `type` | text | `send` \| `receive` \| `grant` \| `swap` |
| `status` | text | `confirmed` \| `pending` \| `failed` |
| `amount` | numeric(28,8) | Token units |
| `amount_usd` | numeric(18,6) | USD at time of tx |
| `token` | text | WLD, USDC, ETH |
| `from_address` | text nullable | |
| `to_address` | text nullable | |
| `tx_hash` | text nullable | Mock blockchain hash |

### `grants`
WLD grant offers for users. Ownership expressed via `identity_id`.

| Column | Type | Notes |
|--------|------|-------|
| `identity_id` | integer FK → identity.id | CASCADE delete |
| `grant_id` | text unique | Business-level ID |
| `type` | text | `world_id` \| `orb_verified` |
| `status` | text | `available` \| `claimed` \| `expired` |
| `amount_wld` | numeric(28,8) | WLD to award |
| `requires_orb` | boolean | Eligibility gate |
| `expires_at` | timestamptz nullable | |

## State Machines

### Grant Status
```
available ──(claim, pass checks)──► claimed
available ──(expired_at reached)──► expired
```

### Verification Session Status
```
pending ──(World ID SDK completes)──► completed
pending ──(expires_at reached)──► expired
```
(The completed transition is not yet implemented — session creation is the only real action.)
