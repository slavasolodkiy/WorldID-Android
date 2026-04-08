# AGENTS.md — Agent Guidance for World App Foundation

## Mission
This repository is an Android-inspired replication project in the World ID / Worldcoin product direction.

Your role is to evaluate and improve it as a reusable product foundation, not just a visual or navigational copy.

## Repository Identity
This is a **web application** (not native Android), inspired by the World / Worldcoin Android app. The repository name reflects the product inspiration, not the implementation platform. Do not add Android, Kotlin, or Java code unless explicitly requested.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite 7 + Tailwind CSS v4 |
| Backend | Express 5 + Node.js 24 (ESM) |
| Database | PostgreSQL + Drizzle ORM |
| Monorepo | pnpm workspaces |
| API contract | OpenAPI 3.1 spec → orval codegen |

## Priority goals
- determine whether implementation depth is real or superficial
- improve code organization and reusability
- identify missing product flows and weak domain modeling
- improve maintainability, configuration hygiene, and handoff quality
- make the project more credible for real replication work

## What good looks like
A strong result should move this repo toward:
- a credible product architecture
- clear separation of UI, state, domain, and data
- realistic user flows
- safe config and secret handling
- scalable screen and navigation structure
- maintainable backend and API assumptions

## Key invariants — do not break
1. **User scoping:** every data access must use `req.currentUser.id` or an equivalent authenticated user context. Never use `LIMIT 1` to pick a user.
2. **Money precision:** token amounts should use `numeric(28,8)` and USD values `numeric(18,6)` or equivalent precise numeric types. Never use `real` or `float` for financial values.
3. **Wallet send is atomic:** balance updates and transaction inserts must happen in one DB transaction.
4. **Grant claim is atomic:** grant status update, balance increment, and transaction insert must happen in one DB transaction.
5. **Address validation:** Ethereum addresses must match `/^0x[0-9a-fA-F]{40}$/` before send operations.
6. **Error contracts:** API errors should use a standard envelope like `{ error: string, code: string }` through shared error helpers, not ad hoc raw responses.
7. **Preserve route map:** do not change public route paths without updating the OpenAPI spec and regenerating the client.

## Workflow

### Schema changes
1. Edit `lib/db/src/schema/*.ts`
2. Run the appropriate DB push or migration command
3. Re-seed if required
4. Update affected services in `artifacts/api-server/src/services/`

### Adding an API endpoint
1. Add it to `lib/api-spec/openapi.yaml`
2. Run `pnpm --filter @workspace/api-spec run codegen`
3. Implement the route in `artifacts/api-server/src/routes/`
4. Add service logic in `artifacts/api-server/src/services/`
5. Add integration tests in `artifacts/api-server/tests/`

### Running integration tests
```bash
pnpm --filter @workspace/api-server run test

## Audit rules

When auditing this repository:

inspect actual code paths and project structure
reference exact files, folders, routes, services, models, and config
separate findings into:
implemented
partially implemented
missing
mocked / stubbed / hardcoded
unclear
judge depth honestly, not by appearance alone

## Review focus

Pay special attention to:

app and module structure
navigation architecture
state management patterns
domain model depth
repository and data layer quality
networking assumptions
local persistence strategy
auth and session lifecycle
onboarding flow
validation and input handling
loading / empty / error / retry states
analytics and logging readiness
environment and config separation
testability and test coverage readiness

## Reuse expectations

Prefer:

modular architecture
isolated data and service layers
centralized config and constants
reusable screens and components
explicit environment handling
minimal duplication
clear naming and package organization

Avoid:

business logic inside UI code
hardcoded secrets
hardcoded URLs and credentials
one-off shortcuts that break reuse
placeholder or demo logic disguised as full implementation

## Mocked / stubbed flows

Be explicit about what is not real. Examples may include:

wallet 24h change based on hardcoded or seeded values
QR code approximations rather than production QR handling
mini-app launch events without a real embedded runtime
swap UI without real route or business logic
verification sessions without real third-party verification
auth headers or demo identity assumptions without cryptographic validation

## Testing approach
Prefer integration tests for auth, wallet, grants, and transactions
Prefer real DB-backed tests over brittle mocks where practical
Seed data should be deterministic and documented

## Files to know
artifacts/api-server/src/
  middlewares/            # auth, error handling, request context
  routes/                 # thin API handlers
  services/               # business logic
lib/db/src/
  schema/                 # Drizzle schema
  seed.ts                 # idempotent seed
lib/api-spec/
  openapi.yaml            # contract source of truth

## Secrets and safety

Never expose or preserve:

database connection strings
passwords
API keys
secret tokens
production secrets in code
plaintext credentials in docs or comments

If found:

flag them immediately
move them to secure config or env handling
update .env.example
recommend rotating exposed secrets

## Product-maturity judgment

Always infer the current maturity level using code evidence:

static mockup
clickable prototype
MVP skeleton
partial product
near-production foundation

## Output format

When asked to review or improve this repo, structure the output as:

Executive summary
Actual stack and architecture
Replication depth assessment
Implemented vs partial vs missing
Mocked / stubbed / hardcoded areas
UX and product-flow gaps
Reuse blockers
Production-readiness blockers
Prioritized backlog:
critical
important
nice-to-have
Best next prompt for Replit

## Do not
add LIMIT 1 to user data queries
use real or float for monetary values
split atomic financial operations into separate DB statements
expose raw DB errors to API clients
store secrets in source code
present this as an official World / Worldcoin product

## Editing rules

Unless explicitly asked:

do not perform sweeping rewrites
do not add unnecessary dependencies
do not optimize prematurely

When editing:

prefer small, clear, high-value changes
preserve working behavior
improve readability and handoff quality
prioritize reusable architecture over fast hacks