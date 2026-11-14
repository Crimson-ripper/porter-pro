# Tech Stack

Chosen for a **two-person team (one developer + Claude), no hires, minimum cost**, while staying able to scale to multiple cities without a rewrite.

## Guiding rules

1. **One language everywhere: TypeScript.** Backend, both mobile apps, admin and landing share types, validation and fare logic. One person can hold the whole system in their head.
2. **Managed services over self-hosting** for anything that holds data (database, files). Backups and security patches are not our job.
3. **Free tiers first, pay as usage grows.** Every service below has a free or near-free starting tier.
4. **Boring, well-documented tools.** Easier to debug alone at 2 a.m.

## The stack

| Layer | Choice | Why this over the alternatives |
|---|---|---|
| Mobile apps | **Expo (React Native) + TypeScript** | Same language as the backend and admin, so types and code are shared. Over-the-air updates (EAS Update) push bug fixes without waiting for store review. Flutter is equally good technically, but would add a second language (Dart) for a solo developer. |
| Maps in apps | **MapLibre (react-native-maplibre) + Ola Maps** | Ola Maps is built for India and much cheaper than Google Maps; its free tier is large. MapLibre is open source, so there are no SDK fees and we can switch tile providers later. |
| Backend API | **Node.js + Fastify + TypeScript** | Fast, lightweight and simple. NestJS adds a lot of structure that helps big teams, but is overhead for one person. |
| Validation | **Zod** (in `packages/shared`) | One schema validates the API input, types the mobile apps and powers admin forms. |
| Database | **PostgreSQL + PostGIS on Supabase** (or Neon) | Managed Postgres with backups. PostGIS handles geo queries (service areas, distance). Free tier is enough for development and the pilot. |
| ORM | **Drizzle ORM** | Lightweight, type-safe, SQL-like; easy migrations; handles PostGIS columns. |
| Live driver locations | **Redis (Upstash, later self-hosted)** with `GEOADD` / `GEOSEARCH` | Finding the nearest free driver in milliseconds. Upstash has a free tier; move to Redis on the VPS when traffic grows. |
| Realtime | **Socket.IO** on the API server | Live tracking, job offers to drivers, order status updates. Scales horizontally with the Redis adapter. |
| Background jobs | **BullMQ** (on Redis) | Dispatch timeouts, retries, scheduled bookings, payouts, notifications. |
| Auth | **Phone OTP (MSG91) + JWT** (access + refresh tokens), built in the API | Full control, no per-user auth fees, works the same for customers, drivers and admins. |
| File storage | **Cloudflare R2** (or Supabase Storage) | KYC documents and proof-of-delivery photos. R2 has no egress fees. |
| Push notifications | **Expo Push (backed by FCM / APNs)** | Free, one API for Android and iOS. |
| Payments | **Razorpay** (UPI, cards, wallets) + **RazorpayX** for driver payouts | Most common in India, good docs, test mode. Cashfree is an equal alternative. |
| Masked calling | **Exotel** (Phase 2) | Customer and driver call each other without seeing real numbers. |
| Admin panel | **Next.js + Tailwind + shadcn/ui** | Same framework as the existing landing page. |
| Landing site | **Next.js** (existing) on Vercel free tier | Already built. |
| API hosting | **One VPS (Hetzner or DigitalOcean, ~₹500-1,500/month) with Docker + Caddy** | Cheapest predictable cost; long-lived WebSocket connections run better on a VPS than on serverless. Railway or Render are fine alternatives if you prefer zero server management (costs a bit more). |
| Monorepo | **npm workspaces** (+ Turborepo later if builds get slow) | No extra tooling to install. |
| CI/CD | **GitHub Actions** | Free for this size. Lint, typecheck, test on every push; deploy API on merge to `main`. |
| App builds | **EAS Build** (Expo) free tier | Builds Android and iOS binaries in the cloud; no Mac needed for iOS. |
| Errors & logs | **Sentry** free tier + **Better Stack / Grafana Cloud** free tier | Know about crashes before users tell you. |

## How it scales

| Stage | Setup | Approx. load |
|---|---|---|
| Pilot (1 city) | 1 small VPS, Supabase free/Pro, Upstash free | up to ~1,000 orders/day |
| Growth (2-5 cities) | 2-3 API servers behind a load balancer, Socket.IO Redis adapter, Supabase Pro, dedicated Redis | ~10,000-50,000 orders/day |
| Scale | Split dispatch/tracking into its own service, read replicas, queue-based event pipeline | beyond that |

Nothing in the stack has to be thrown away between stages. Each step is adding servers or splitting one service out.

## What we deliberately avoid (for now)

- **Microservices / Kubernetes**: too much operations work for one person. One well-structured API is enough until real scale.
- **Firebase as the main backend**: fast to start, but geo queries, complex transactions (payments, wallets) and costs at scale get painful.
- **Google Maps**: best quality, but the most expensive line item at scale for Indian logistics apps.
- **Two native codebases (Kotlin + Swift)**: double the work.
