# Feature Checklist

Everything that has to be built, grouped by app. Tick items as they are completed.

Priority: **P0** = needed for MVP launch, **P1** = soon after launch, **P2** = growth / later.

---

## 1. Shared package (`packages/shared`)

- [ ] P0 Domain types: User, Driver, Vehicle, VehicleType, Order, OrderStop, Payment, Wallet, Payout, Rating
- [ ] P0 Zod schemas for every API request/response
- [ ] P0 Order status enum and allowed transitions (state machine)
- [ ] P0 Fare calculation function (base fare + per km + per minute + waiting + minimum fare)
- [ ] P0 Constants: vehicle types, cities, cancellation reasons
- [ ] P1 Phone number, GST and vehicle-number validators
- [ ] P1 Typed API client used by both mobile apps and admin

## 2. Backend API (`apps/api`)

### Foundation
- [ ] P0 Fastify server setup, config via env, structured logging
- [ ] P0 Drizzle ORM + PostgreSQL/PostGIS connection, migrations
- [ ] P0 Error handling, request validation (Zod), rate limiting
- [ ] P0 Health check endpoint
- [ ] P0 Dockerfile + docker-compose for local dev (Postgres, Redis)
- [ ] P1 OpenAPI / Swagger docs generated from schemas
- [ ] P1 Unit + integration test setup

### Auth & users
- [ ] P0 Send OTP (MSG91), verify OTP, resend limit
- [ ] P0 JWT access + refresh tokens, logout, device sessions
- [ ] P0 Roles: customer, driver, admin (with permission checks)
- [ ] P0 Customer profile: name, email, saved addresses (home, work, other)
- [ ] P1 Business account fields (company name, GSTIN)
- [ ] P2 Admin sub-roles: ops, support, finance

### Driver onboarding & KYC
- [ ] P0 Driver registration: personal details, city, vehicle type
- [ ] P0 Document upload (DL, RC, Aadhaar, PAN, vehicle photo, insurance) to R2 with signed URLs
- [ ] P0 KYC status: pending → under review → approved / rejected (with reason)
- [ ] P0 Bank account / UPI ID for payouts
- [ ] P1 Document expiry tracking and reminders
- [ ] P2 Automated DL/RC verification via a KYC API provider

### Pricing
- [ ] P0 Rate card per city × vehicle type (base, per km, per min, min fare, free waiting minutes)
- [ ] P0 Fare estimate endpoint using Ola Maps route distance/time
- [ ] P0 Toll/extra charges field
- [ ] P1 Coupons: flat / percentage, max discount, usage limit, validity
- [ ] P1 Helper/labour add-on pricing
- [ ] P2 Surge pricing by zone and time
- [ ] P2 Enterprise custom rate contracts

### Orders
- [ ] P0 Create order (pickup, drop, vehicle type, goods type, payment method)
- [ ] P0 Order state machine: searching → assigned → arriving → at pickup → picked up → in transit → delivered → completed / cancelled
- [ ] P0 Pickup and drop OTP verification
- [ ] P0 Customer and driver cancellation with reasons and cancellation fee rules
- [ ] P0 Order history (customer and driver)
- [ ] P0 Proof of delivery photo
- [ ] P0 Ratings and feedback (both directions)
- [ ] P1 Multi-stop orders (up to N drops)
- [ ] P1 Scheduled bookings (pick a future time)
- [ ] P1 Waiting time charges
- [ ] P1 GST invoice PDF generation and email
- [ ] P2 Packers & movers flow (inventory list, quote)
- [ ] P2 Bulk orders / API for business customers

### Dispatch & realtime (the core)
- [ ] P0 Driver online/offline state
- [ ] P0 Driver location ingest (every 5-10 s) into Redis GEO + last-known in Postgres
- [ ] P0 Matching: find nearest available drivers of the right vehicle type within radius
- [ ] P0 Offer job to driver(s) with timeout (BullMQ), retry with next driver, widen radius
- [ ] P0 Accept / reject, prevent double assignment (locking)
- [ ] P0 Socket.IO rooms: per order (customer tracking), per driver (job offers)
- [ ] P0 Live ETA updates
- [ ] P0 "No driver found" handling and auto-cancel
- [ ] P1 Driver acceptance rate, rejection penalties, scoring in matching
- [ ] P1 Push notification fallback when the app is in the background
- [ ] P2 Batching/chaining jobs for drivers
- [ ] P2 Socket.IO Redis adapter for multiple servers

### Payments & money
- [ ] P0 Razorpay order creation, payment verification, webhooks
- [ ] P0 Cash on delivery: driver collects, recorded against driver
- [ ] P0 Commission calculation per trip (platform cut vs driver earning)
- [ ] P0 Driver ledger: earnings, cash collected, commission owed, balance
- [ ] P1 Customer wallet (top-up, refunds to wallet)
- [ ] P1 Refunds (full/partial) via Razorpay
- [ ] P1 Weekly driver payouts via RazorpayX
- [ ] P1 Driver dues collection (cash collected exceeds earnings)
- [ ] P2 Driver subscription plans / incentives / daily targets
- [ ] P2 Referral rewards

### Notifications & communication
- [ ] P0 Push notifications (Expo Push) for order events
- [ ] P0 SMS for OTP and critical updates
- [ ] P1 In-app support tickets
- [ ] P1 Share live tracking link (web page)
- [ ] P2 Masked calling (Exotel)
- [ ] P2 In-app chat between customer and driver

### Ops & safety
- [ ] P0 Audit log for admin actions
- [ ] P0 Block / suspend users and drivers
- [ ] P1 SOS button events
- [ ] P1 Fraud checks: fake GPS detection, repeated cancellations
- [ ] P2 Analytics event pipeline

## 3. Customer app (`apps/customer-app`)

- [ ] P0 Splash, onboarding, login with phone OTP
- [ ] P0 Home: map with current location, "Where to pick up?"
- [ ] P0 Pickup & drop selection: search (Ola Maps autocomplete), pin on map, saved addresses
- [ ] P0 Pickup/drop contact name & phone
- [ ] P0 Vehicle selection with fare estimate and ETA
- [ ] P0 Goods type, payment method, apply coupon (P1)
- [ ] P0 Booking confirmation → "Searching for driver" screen
- [ ] P0 Live tracking: driver on map, driver details, vehicle number, call driver, OTP display
- [ ] P0 Cancel booking with reason
- [ ] P0 Trip completed: fare breakdown, pay online, rate driver
- [ ] P0 Order history and order details
- [ ] P0 Profile, saved addresses, logout
- [ ] P1 Multi-stop booking UI
- [ ] P1 Schedule for later
- [ ] P1 Wallet, invoices download
- [ ] P1 Help & support, FAQs, raise ticket
- [ ] P1 Share trip tracking link
- [ ] P2 Business account mode, Hindi + regional languages, referral screen

## 4. Driver app (`apps/driver-app`)

- [ ] P0 Login with phone OTP
- [ ] P0 Onboarding: personal details, vehicle details, document upload with camera
- [ ] P0 KYC status screen (pending / rejected with reason / approved)
- [ ] P0 Home: online/offline toggle, map, today's earnings
- [ ] P0 Background location tracking while online (foreground service on Android)
- [ ] P0 Incoming job offer screen: pickup, drop, distance, fare, accept/reject timer, loud alert
- [ ] P0 Trip flow: navigate to pickup (open in Google Maps), arrived, enter pickup OTP, start trip, navigate to drop, enter drop OTP, upload POD photo, collect cash, complete
- [ ] P0 Earnings: per trip, daily, weekly; trip history
- [ ] P0 Bank / UPI details
- [ ] P1 Wallet / ledger: commission owed, payouts, pay dues
- [ ] P1 Rate customer, report issue, SOS
- [ ] P1 Battery-optimisation guidance (stay online reliably on Xiaomi/Oppo/Vivo etc.)
- [ ] P2 Incentives & targets screen, subscription plans, Hindi language

## 5. Admin panel (`apps/admin`)

- [ ] P0 Admin login (OTP or email + password), role-based access
- [ ] P0 Dashboard: orders today, active trips, online drivers, revenue
- [ ] P0 Driver management: list, filters, KYC review (view documents, approve/reject), suspend
- [ ] P0 Customer management: list, details, block
- [ ] P0 Order management: list, filters, order detail timeline, cancel, manual assign driver
- [ ] P0 Live map: all online drivers and active trips
- [ ] P0 Rate cards per city and vehicle type
- [ ] P0 City & service area management (draw polygon on map)
- [ ] P1 Coupons management
- [ ] P1 Refunds, driver ledger, payouts approval, settlement reports
- [ ] P1 Support tickets
- [ ] P1 Export CSV reports
- [ ] P2 Surge zones, incentives configuration, enterprise accounts, analytics charts

## 6. Landing site (`apps/landing`)

- [x] Initial landing page
- [ ] P0 Driver sign-up CTA (link to driver app on Play Store)
- [ ] P0 Privacy policy, terms of service, refund policy pages (required by Play Store and Razorpay)
- [ ] P1 Live tracking share page (`/track/[id]`) (could live here or in admin)
- [ ] P1 Fare estimator, city pages for SEO

## 7. DevOps & launch

- [ ] P0 GitHub Actions: lint, typecheck, test on every PR
- [ ] P0 Environments: local, staging, production (separate databases and keys)
- [ ] P0 VPS setup: Docker, Caddy (HTTPS), automatic deploy from `main`
- [ ] P0 Database backups (Supabase) + tested restore
- [ ] P0 Sentry in API and both apps
- [ ] P0 EAS Build profiles: development, preview (internal testing), production
- [ ] P0 Play Store listing for both apps (internal testing → closed testing → production)
- [ ] P1 App Store listing (iOS) — can follow after Android
- [ ] P1 Uptime monitoring and alerts
- [ ] P1 Load test dispatch with simulated drivers
- [ ] P1 Security review checklist (auth, payments, file access, rate limits)

## 8. Business / non-code (you)

- [ ] Company registration, GST, current bank account
- [ ] Razorpay, MSG91, Ola Maps, Expo, Google Play, Apple Developer accounts
- [ ] Pricing and commission decisions for the launch city
- [ ] Terms of service, privacy policy (legal template + review)
- [ ] Goods-in-transit insurance research
- [ ] Recruit 30-50 pilot drivers
- [ ] Support phone/WhatsApp number
