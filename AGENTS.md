# AGENTS.md

## Mission
This repository is an Android replication project inspired by the World ID / Worldcoin product direction.

Your role is to evaluate and improve it as a reusable Android product foundation, not just a visual or navigational copy.

## Priority goals
- determine whether implementation depth is real or superficial
- improve code organization and reusability
- identify missing product flows and weak domain modeling
- improve maintainability, configuration hygiene, and handoff quality
- make the project more credible for real replication work

## What good looks like
A strong result should move this repo toward:
- a credible Android app architecture
- clear separation of UI, state, domain, and data
- realistic user flows
- safe config and secret handling
- scalable screen/navigation structure
- maintainable backend/API assumptions

## Audit rules
When auditing this repository:
- inspect actual code paths and project structure
- reference exact packages, files, classes, composables/views, services, repositories, models, and config
- separate findings into:
  - implemented
  - partially implemented
  - missing
  - mocked / stubbed / hardcoded
  - unclear
- judge depth honestly, not by appearance alone

## Android-specific review focus
Pay special attention to:
- app/module structure
- activity/screen/navigation architecture
- state management patterns
- domain model depth
- repository/data layer quality
- networking assumptions
- local storage/persistence strategy
- auth/session lifecycle
- onboarding flow
- validation and input handling
- loading / empty / error / retry states
- permissions handling
- analytics/logging readiness
- environment/config separation
- testability and test coverage readiness

## Reuse expectations
Prefer:
- modular architecture
- isolated data/service layers
- centralized config/constants
- reusable screens/components
- explicit environment handling
- minimal code duplication
- clear naming and package organization

Avoid:
- business logic inside UI code
- hardcoded secrets
- hardcoded URLs and credentials
- one-off shortcuts that break reuse
- placeholder/demo logic disguised as full implementation

## Secrets and safety
Never expose or preserve:
- database connection strings
- passwords
- API keys
- secret tokens
- production secrets in code
- plaintext credentials in docs or comments

If found:
- flag them immediately
- recommend moving them to secure config/env handling
- recommend `.env.example` or config template equivalents
- recommend rotating exposed secrets

## Product-maturity judgment
Always infer the current maturity level:
- static mockup
- clickable prototype
- MVP skeleton
- partial product
- near-production foundation

Back every judgment with code evidence.

## Output format
When asked to review or improve this repo, structure the output as:
1. Executive summary
2. Actual Android stack and architecture
3. Replication depth assessment
4. Implemented vs partial vs missing
5. Mocked / stubbed / hardcoded areas
6. UX/product-flow gaps
7. Reuse blockers
8. Production-readiness blockers
9. Prioritized backlog:
   - critical
   - important
   - nice-to-have
10. Best next prompt for Replit

## Editing rules
Unless explicitly asked:
- do not perform sweeping rewrites
- do not add unnecessary dependencies
- do not optimize prematurely

When editing:
- prefer small, clear, high-value changes
- preserve working behavior
- improve readability and handoff quality
- prioritize reusable architecture over fast hacks