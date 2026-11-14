# Porter Pro

On-demand intra-city goods transport platform (2-wheelers, 3-wheelers, mini-trucks), built by a two-person team: one developer + Claude.

**Current stage: proof of concept, ₹0 running cost.**

## Repository layout

```
apps/
  api/            Backend: Fastify + TypeScript, Postgres (PGlite locally / Supabase), Socket.IO
  customer-app/   Customer mobile app (Expo / React Native)
  driver-app/     Driver partner mobile app (Expo / React Native)
  landing/        Marketing website (Next.js)
  admin/          Admin panel (not started; admin API endpoints exist)
packages/
  shared/         Types, fare logic, order statuses, API client — used by every app
docs/             Stack, feature checklist, roadmap, costs
```

## What works today

- Phone login with test OTP **123456** (no SMS cost)
- Customer: pick pickup/drop (search or pin on map), see fares for 4 vehicle types, book (cash)
- Dispatch: offers the job to the nearest online driver of that vehicle type, 20 s to accept, then the next driver
- Live tracking: driver position streamed to the customer's map
- Driver: vehicle setup, online/offline, job offer with countdown, navigate, arrive, pickup OTP check, complete, earnings
- Cancellation by customer or driver, rating, order and trip history
- Fake-driver simulator for testing alone

## Run it

You need **Node.js 20+** on the laptop and the **Expo Go** app on your Android phone. Phone and laptop must be on the **same Wi-Fi**.

### 1. Install (once)

```bash
npm install
```

### 2. Start the backend

```bash
npm run dev:api
```

The API runs on port 4000 with a built-in local database (saved in `apps/api/.data`). No account needed. To use Supabase instead, copy `apps/api/.env.example` to `apps/api/.env` and set `DATABASE_URL`.

### 3. Start the customer app (new terminal)

```bash
npm run dev:customer
```

Scan the QR code with Expo Go. Allow location access.

### 4. Test with fake drivers (new terminal)

```bash
npm run simulate -- --lat 28.6315 --lng 77.2167
```

Use **your own** latitude/longitude (long-press in Google Maps to copy them) so the fake drivers appear near you. Then book a trip in the customer app and watch a driver come to you.

### 5. Or test with a real driver phone

Stop the simulator, then on a second phone:

```bash
npm run dev:driver
```

Log in with a different number, add vehicle details, go online. Book from the customer phone with the same vehicle type.

The driver app's dev server uses port 8082, so both apps can run at the same time (one phone each).

### Automatic end-to-end check

With the API and simulator running:

```bash
npm run smoke -w apps/api
```

Books a trip as a test customer and waits for a fake driver to deliver it.

### If the phone can't reach the API

- Check both devices are on the same Wi-Fi, and allow Node.js through Windows Firewall (private networks) when asked.
- Or expose the API with a free Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:4000`) and start the app with `EXPO_PUBLIC_API_URL=<tunnel url>`.

## PoC limitations (by design, fixed later)

| Limitation | Production fix |
|---|---|
| Test OTP, no SMS | MSG91 |
| Distance = straight line × 1.3 | Ola Maps route distance |
| Driver location only while the app is open | Background location task + Android foreground service (needs a dev build) |
| Dispatch state in memory, one server | Redis + BullMQ |
| Cash only | Razorpay |
| No KYC documents | Document upload + admin review |
| Address search via OpenStreetMap (1 request/second) | Ola Maps |

See [docs/ROADMAP.md](docs/ROADMAP.md) for what comes next.
