# Transactions and Grants

## Transaction Flow

### Send (real, atomic)

`POST /api/wallet/send` → `WalletService.send()`

**Validations (all checked before DB access):**
- `toAddress` must match `/^0x[0-9a-fA-F]{40}$/` — ETH address format
- `amount` must be `> 0` and a finite number
- `toAddress` must not equal sender's own wallet address
- `token` must exist in user's wallet
- User's balance in that token must be `>= amount`

**If all checks pass, a DB transaction atomically:**
1. Updates `tokens.balance` (subtract amount) and `tokens.balance_usd`
2. Inserts a `transactions` row with `type=send`

**Error codes:**
| Code | HTTP | Meaning |
|------|------|---------|
| `INVALID_ADDRESS` | 400 | Not a valid ETH address |
| `INVALID_AMOUNT` | 400 | Amount ≤ 0 or non-finite |
| `SELF_SEND` | 400 | Sending to own address |
| `TOKEN_NOT_FOUND` | 404 | Token not in wallet |
| `INSUFFICIENT_BALANCE` | 400 | Balance too low |

**What is NOT real:**
- The `txHash` is a randomly generated hex string, not a real blockchain transaction.
- No blockchain is contacted.

### Receive

`GET /api/wallet/receive` returns the user's wallet address and a QR code data URI. The QR image is a static SVG approximation — not a real QR code generated from the address.

### Grant (from claim)

When a grant is claimed, the backend inserts a `type=grant` transaction. This is handled inside `GrantsService.claim()` as part of the same DB transaction.

---

## Grant Claim Flow

`POST /api/grants/claim` → `GrantsService.claim()`

**Pre-conditions checked:**
1. Grant exists and belongs to the current user
2. Grant status is `available` (not `claimed` or `expired`)
3. Expiry timestamp has not passed
4. If `requiresOrb=true` → user's `verificationLevel` must be `orb`

**If all checks pass, a DB transaction atomically:**
1. Updates `grants.status` to `claimed`
2. Updates `tokens.balance` (adds WLD amount) and `tokens.balance_usd`
3. Inserts a `transactions` row with `type=grant`

**Error codes:**
| Code | HTTP | Meaning |
|------|------|---------|
| `GRANT_NOT_FOUND` | 404 | Grant missing or belongs to different user |
| `ALREADY_CLAIMED` | 409 | Grant already claimed |
| `GRANT_EXPIRED` | 400 | Expiry timestamp has passed |
| `GRANT_UNAVAILABLE` | 400 | Other unavailable status |
| `ORB_VERIFICATION_REQUIRED` | 403 | Grant requires orb, user not orb-verified |

---

## Money Representation

All financial values in the database use PostgreSQL `NUMERIC` type:

| Field | Type | Precision |
|-------|------|-----------|
| Token balance (crypto) | `numeric(28, 8)` | 8 decimal places |
| Token balance (USD) | `numeric(18, 6)` | 6 decimal places |
| Token price (USD) | `numeric(18, 6)` | 6 decimal places |
| Transaction amount (crypto) | `numeric(28, 8)` | 8 decimal places |
| Transaction amount (USD) | `numeric(18, 6)` | 6 decimal places |
| Grant amount (WLD) | `numeric(28, 8)` | 8 decimal places |
| Grant amount (USD) | `numeric(18, 6)` | 6 decimal places |

Drizzle ORM returns `numeric` columns as JavaScript strings. Service layers parse them with `parseFloat()` before including them in API responses (where clients receive plain numbers).

**Why not `real`/`float`?** Floating-point types accumulate rounding errors — `0.1 + 0.2 !== 0.3` in IEEE 754. For financial values, this is unacceptable. `NUMERIC` stores exact decimal values.

---

## Transaction Types

| Type | Triggered by | Balance effect |
|------|--------------|---------------|
| `send` | `POST /api/wallet/send` | Decrements sender's token balance |
| `receive` | External (seeded only) | No automatic balance change yet |
| `grant` | `POST /api/grants/claim` | Increments WLD balance |
| `swap` | Not yet implemented | N/A |
