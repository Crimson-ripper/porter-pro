# Development Roadmap

Team: **you (B.Tech CSE graduate) + Claude**. No hires.

How we work:
- Claude writes most of the code, tests and configs in this repo.
- You run it, test it on real phones, review every change, ask "why" until you understand it, and handle accounts, keys and real-world testing.
- One phase = one or more branches → pull request → you review and merge into `main`.
- Rough pace assumes you work on this **full-time (6-8 hours/day)**. Part-time roughly doubles the timeline.

Feature details for every phase are in [FEATURES.md](FEATURES.md).

---

## Phase 0 — Foundation (Week 1-2)

- Monorepo with npm workspaces (`apps/*`, `packages/*`)
- `packages/shared`: types, Zod schemas, order state machine, fare function
- `apps/api`: Fastify skeleton, Drizzle + Supabase Postgres/PostGIS (free tier; no Docker for the PoC)
- Database schema v1: users, drivers, vehicles, vehicle_types, cities, rate_cards, orders, order_stops, order_events, payments, ledger_entries
- GitHub Actions: lint + typecheck + tests
- **You:** create a free Supabase account; install Expo Go on your Android phone

**Done when:** `npm run dev` starts the API and it talks to the Supabase database.

## Phase 1 — Auth & core API (Week 3-5)

- OTP login (MSG91; console-logged OTP in local dev), JWT + refresh
- Customer profile & saved addresses
- Driver registration, vehicle, document upload (R2 signed URLs), KYC status
- Rate cards and fare estimate (Ola Maps directions)
- Create order, order state machine, cancel, history
- **You:** test every endpoint with the Swagger UI / Bruno collection

**Done when:** a full order can be created and pushed through all statuses using API calls only.

## Phase 2 — Dispatch & realtime (Week 6-8)

- Driver online/offline + location updates into Redis GEO
- Matching: nearest drivers by vehicle type, offer with timeout, retry, widen radius
- Socket.IO: order room for customer tracking, driver room for offers
- Pickup/drop OTP, ETA updates
- **Driver simulator script**: 50 fake drivers moving around the city, so dispatch can be tested without real phones

**Done when:** a booking automatically finds a simulated driver and the trip plays out live in real time.

## Phase 3 — Customer app (Week 9-12)

- Expo app: login, map home, pickup/drop search, vehicle + fare selection, booking, searching screen, live tracking, cancel, completion & rating, history, profile
- **You:** run it on your Android phone with Expo Go / dev build daily

**Done when:** you can book a trip from your phone and watch a simulated driver come to you.

## Phase 4 — Driver app (Week 13-16)

- Expo app: login, onboarding + document camera upload, KYC status, online toggle, background location (Android foreground service), job offer alert, full trip flow, POD photo, earnings
- **You:** two-phone test — customer app on one phone, driver app on another, real roads

**Done when:** a real end-to-end trip works between two phones on the road.

## Phase 5 — Admin panel (Week 17-19)

- Next.js admin: login, dashboard, KYC review, drivers, customers, orders, manual assign, live map, rate cards, cities/service areas

**Done when:** you can approve a driver and run the business day from the admin panel.

## Phase 6 — Payments & money (Week 20-22)

- Razorpay checkout in customer app, webhooks, cash on delivery
- Commission + driver ledger, refunds, invoices (PDF)
- **You:** Razorpay account KYC (needs company/GST), test-mode end-to-end

**Done when:** online and cash trips both settle correctly in the ledger.

## Phase 7 — Hardening & pilot (Week 23-26)

- Sentry, logging, backups, staging environment, production VPS
- Security checklist, rate limiting, load test with 500 simulated drivers
- Privacy policy, terms, refund policy on landing site
- Play Store internal → closed testing for both apps
- **Pilot:** 30-50 drivers in one area of one city, real orders, fix what breaks

**Done when:** 2 weeks of real trips with no critical bugs → **public Android launch** (~month 6).

## Phase 8 — After launch (Month 7-10)

In priority order, driven by what pilot users ask for:
1. Coupons, customer wallet, weekly driver payouts (RazorpayX), support tickets
2. Multi-stop, scheduled bookings, helper add-on, share tracking link
3. iOS App Store release
4. Surge pricing, driver incentives, referrals
5. Masked calling, business accounts, Hindi language
6. Second city

---

## Timeline summary

| Milestone | Full-time | Part-time |
|---|---|---|
| API + dispatch working with simulator | ~2 months | ~4 months |
| Both apps working end to end | ~4 months | ~8 months |
| Pilot | ~5-6 months | ~10-11 months |
| Public Android launch (1 city) | **~6 months** | ~12 months |
| Full feature set | ~10 months | ~18+ months |

## Rules that keep a two-person project alive

1. **Ship the smallest version first.** P0 only until launch. Write every new idea into FEATURES.md as P1/P2 instead of building it now.
2. **Everything in git, every change through a PR.** Never edit production by hand.
3. **Test on cheap Android phones** (Redmi, Realme) — that's what drivers use.
4. **Understand the core yourself:** the order state machine, dispatch and the money ledger. Those are where bugs cost real money.
5. **Don't skip the simulator.** It lets you test dispatch at midnight without 50 friends.
