# Porter Pro

On-demand intra-city goods transport platform (2-wheelers, 3-wheelers, mini-trucks), built by a two-person team: one developer + Claude.

## Repository layout

```
apps/
  landing/        Marketing website (Next.js) - already built
  api/            Backend: REST + realtime dispatch (Node.js, Fastify, TypeScript)
  customer-app/   Customer mobile app (Expo / React Native)
  driver-app/     Driver partner mobile app (Expo / React Native)
  admin/          Operations & admin panel (Next.js)
packages/
  shared/         Shared TypeScript types, Zod schemas, fare logic, constants
docs/
  STACK.md        Chosen tech stack and why (cost, scalability, maintenance)
  FEATURES.md     Full checklist of everything to build, by app
  ROADMAP.md      Phase-by-phase development plan with timeline
  COSTS.md        Budget for a two-person, no-hiring build
```

## Status

| App | Status |
|---|---|
| landing | Done (initial version) |
| api | Not started |
| customer-app | Not started |
| driver-app | Not started |
| admin | Not started |
| shared | Not started |

Start with [docs/ROADMAP.md](docs/ROADMAP.md).
