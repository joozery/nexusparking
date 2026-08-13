# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (Next.js, port 3000)
npm run build    # production build (also type-checks)
npm run lint     # ESLint
npx tsc --noEmit # type-check without building
```

No test runner is configured. Use `npm run build` or `npx tsc --noEmit` to verify correctness.

## Environment

Requires `.env.local`:
```
MONGODB_URI=mongodb://...
JWT_SECRET=...
```

## Business Rules

These are the canonical billing rules from the product requirements. All fee logic in `calcFee.ts` must conform to these.

### Parking Rates

| Card type | First hour | Additional hours | Rounding |
|-----------|-----------|-----------------|---------|
| Car | ฿30 | ฿20 / hr | Any partial hour → full hour (ceiling) |
| Motorcycle | ฿20 | ฿10 / hr | Any partial hour → full hour (ceiling) |

### Overnight Rate (18:00–07:00)
- Flat rate **฿100** per overnight window (applies once per window crossed, only if stay reaches `flatRateStart` = 22:00)
- Time **outside** the overnight window (before 18:00 or after 07:00) billed at **฿20 / hr** (ceiling per segment)

### Special Cases
- **Lost card**: regular parking fee + flat fine ฿300 (`settings.lostCardFine`)
- **After-hours exit** (22:00–06:30): regular parking fee + surcharge ฿300 (`settings.afterHoursFine`)
- Plate stored as **4-digit suffix** only — operators enter the last 4 characters at check-in

### Hardware Triggers

| Event | Camera | Barrier | Printer | Cash Drawer |
|-------|--------|---------|---------|-------------|
| Check-in confirmed | Snapshot ✓ | Open ✓ | — | — |
| Check-out paid | Snapshot ✓ | Open ✓ | Receipt (on request) | Open ✓ |

---

## Architecture

### Route Groups

Two separate UX contexts inside `src/app/`:

| Group | Path prefix | Audience |
|-------|------------|----------|
| `(dashboard)` | `/dashboard`, `/settings`, `/reports`, `/monitor`, etc. | Admin / manager — full sidebar layout |
| `(operator)` | `/operator` | Cashier touchscreen — no sidebar, shift-gated |

The operator page is a single large client component (`operator/page.tsx`). All state (sessions, stats, queue, shift, dialogs) lives there — no sub-components for state.

### Auth

Custom JWT — **no NextAuth**. `src/lib/auth.ts` signs/verifies HS256 tokens using Node's `crypto`. The middleware (`src/middleware.ts`) re-verifies using the Web Crypto API (Edge-compatible). Token stored in `httpOnly` cookie `np_session` (8 h TTL).

Roles: `superadmin` → `admin` → `operator`. Routes are protected globally by middleware; there is no per-route role guard in the API layer beyond checking `verifyToken(cookie)`.

### Database

MongoDB via Mongoose. Single connection cached on `global._mongoose` (`src/lib/mongodb.ts`). Call `await connectDB()` at the top of every API route handler.

**Models** (`src/models/`):

| Model | Key fields |
|-------|-----------|
| `Admin` | username, passwordHash, role |
| `ParkingSession` | cardUid, cardType, plate, entryTime, exitTime, status (`active`/`completed`/`lost`), isSimulated |
| `ParkingCard` | uid, type (`car`/`motorcycle`/`overnight`), isActive |
| `ParkingQueue` | plate, cardType, status (`waiting`/`entered`/`cancelled`) |
| `Shift` | operatorId, status (`active`/`closed`), cashAmount, qrAmount |
| `Discount` | discountType (`fixed`/`percent`/`per_day`), discountValue, maxDiscount |
| `SystemSettings` | singleton — one document only, fetched via `getSettings()` |
| `HardwareLog` | device, action, success |

### SystemSettings Singleton

`getSettings()` in `src/models/SystemSettings.ts` returns the single settings document, creating it with defaults if absent. Always use `getSettings()` rather than querying directly.

Key fields:
- `businessHours` — `{ open: 'HH:MM', close: 'HH:MM' }` (default 06:30–22:00)
- `capacity` — `{ car: number, motorcycle: number }`
- `rates.overnight` — `{ windowStart, windowEnd, flatRateStart, flatRate, extraHour }`
- `hardware` — per-device `{ ip, port, endpoint, enabled }` (camera, barrier, reader, printer, drawer)
- `lostCardFine` — flat fine added to fee on lost-card checkout (default 300)
- `afterHoursFine` — surcharge added when exit time falls outside business hours (default 300)

**Mongoose migration caveat**: Mongoose schema defaults only apply when _creating_ a new document. Fields added to the schema after the singleton already exists will be `undefined` when fetched — not the schema default. Always use `?? fallback` when reading newer fields from settings in client code (see operator page `fetchSettings`).

### Fee Calculation (`src/lib/calcFee.ts`)

Three exported functions:

```
calcFeeBreakdown(cardType, entryTime, exitTime, overnightConfig?, afterHoursConfig?)
  → { segments: FeeSegment[], total: number }

calcFeeFromMinutes(type, minutes, entryTime?, exitTime?, overnightConfig?, afterHoursConfig?)
  → number   (delegates to calcFeeBreakdown when both times are provided)

calcDurationMinutes(entryTime, exitTime) → number
```

`FeeSegment.kind` values: `'normal' | 'outside' | 'overnight' | 'after-hours'`

**Overnight logic**: if a stay spans the configured overnight window (default 18:00–07:00), it switches to overnight mode. Each overnight window crossed costs `flatRate` (if exit passes `flatRateStart`), otherwise `extraHour` per hour. Time outside all windows costs `ceil(minutes/60) × extraHour` — ceiled per segment, not in aggregate.

**After-hours logic**: if exit time falls between `businessHours.close` and `businessHours.open` (default 22:00–06:30), an `'after-hours'` segment is appended with `fee = afterHoursFine`. This applies to **all** card types including normal sessions — it is checked at the end of both the overnight and non-overnight branches of `calcFeeBreakdown`.

Always pass `settings.rates.overnight` and an `afterHoursConfig` derived from `settings.businessHours` + `settings.afterHoursFine` into these functions. The defaults inside the file are fallbacks for operator-page live preview only.

### API Conventions

- Every route file starts with `await connectDB()`
- Auth token read via `const token = (await cookies()).get(COOKIE_NAME)?.value`
- Settings fetched with `await getSettings()`
- Checkin API accepts optional `entryTime` (ISO string) for backdating — used by simulator/testing

### Checkin / Checkout Flow

```
Operator scans card → CheckInDialog (scan → confirm steps)
  → POST /api/sessions/checkin
    - validates capacity (activeSessions < capacity.car + capacity.motorcycle)
    - validates business hours
    - creates ParkingSession { status: 'active' }
    - increments shift.checkinsCount

Operator selects session → CheckOutDialog
  → POST /api/sessions/checkout
    - calcFeeFromMinutes with overnightConfig + afterHoursConfig from DB
    - applies store discount (fixed/percent) if discountId provided
    - applies per-night discount if dailyDiscountId provided
    - updates session { status: 'completed', exitTime, totalFee }
    - increments shift.checkoutsCount + cashAmount/qrAmount
```

Lost card flow: `POST /api/sessions/lost` — creates a completed session with `lostFine = settings.lostCardFine` added to fee.

Queue activates automatically when `stats.availableSlots === 0`. `POST /api/queue/{id}/enter` promotes a queued car to an active session.

### Simulator (`/simulator`)

Dev tool page — not behind a role guard. Two features:
1. **Fee Calculator** — client-side only, calls `calcFeeBreakdown` directly, no DB writes
2. **Batch Seed** — `POST /api/simulate` creates `ParkingSession` records with `isSimulated: true`; `DELETE /api/simulate` wipes them all

### CCTV Monitor (`/monitor`)

Dashboard page showing 3 camera feeds: กล้องป้ายทะเบียน (CAM-01, large), กล้องหน้าคนขับ (CAM-02), กล้อง Rear (CAM-03). Camera URLs stored in `localStorage` under key `np_cctv_urls` — no DB involvement.

**URL types supported:**
- Snapshot JPEG (e.g. `http://IP/snapshot.jpg`) — polled every 2 s via `<img src={url + '?_t=' + ticker}>`
- MJPEG stream (URL contains `stream.mjpeg`, `.mjpg`, or `mjpeg`) — set as static `<img>` src, no ticker
- `rtsp://` URLs — detected and blocked with a warning; must go through go2rtc first

**go2rtc proxy** (`go2rtc.yaml` in project root, binary `./go2rtc`):
- Converts IP camera streams (RTSP, MJPEG-over-HTTP) to browser-viewable MJPEG
- Listens on port 1984; MJPEG endpoint: `http://localhost:1984/api/stream.mjpeg?src=STREAM_NAME`
- Uses ffmpeg source for MJPEG cameras: `ffmpeg:http://user:pass@IP:PORT/video#video=mjpeg`
- Runs as launchd service: `~/Library/LaunchAgents/com.parkingcar.go2rtc.plist` (wrapper at `~/bin/go2rtc-parkingcar.sh` sets `PATH=/opt/homebrew/bin:...`)
- launchd must have `PATH` set to include Homebrew (`/opt/homebrew/bin`) for ffmpeg to be found

**Camera proxy API** (`/api/camera`) — fallback when go2rtc can't handle a source:
- Proxies any HTTP camera URL with Basic Auth via query params: `?url=...&u=admin&p=pass`
- Uses Next.js `fetch` streaming — less stable than go2rtc for long-lived MJPEG connections

**Keyboard shortcut**: `Alt+C` (Option+C on Mac) toggles CAM-01 fullscreen. Uses `document.addEventListener('keydown')` — skips when focus is in an input/textarea.

### Hardware Integration

**Critical split — barrier must be triggered from the browser, not from Vercel server-side:**

| Device | Trigger location | Reason |
|--------|-----------------|--------|
| Camera, Printer, Drawer | `src/lib/hardware.ts` (server-side, API routes) | Fine on Vercel |
| **Barrier** | `src/lib/barrierClient.ts` (client-side, browser) | Windows machine is on Tailscale — only reachable from the parking lot browser, not from Vercel cloud |

`src/lib/hardware.ts` — server-side fire-and-forget HTTP calls. `runCheckinSequence` triggers camera only. `runCheckoutSequence` triggers camera + drawer + printer. **Do not add barrier back here.**

`src/lib/barrierClient.ts` — fetches `settings.hardware.barrier` from `/api/settings`, then calls `http://{ip}:{port}{endpoint}?cmd={direction}` directly from the browser. Called in `operator/page.tsx` after successful checkin/checkout API response.

**barrier_server.js** (runs on Windows at the parking lot, not committed as a Next.js file):
- Node.js HTTP server on port 8080, connected to Arduino Uno on COM3 @ 9600 baud
- `cmd=checkin` → sends `'1\n'` via serial (entry barrier open)
- `cmd=checkout` → sends `'2\n'` via serial (exit barrier open)
- Includes CORS headers — required because browser makes cross-origin requests to `http://100.121.70.116:8080`
- Tailscale IP of Windows machine: `100.121.70.116`
- Run with: `node barrier_server.js` (requires `npm install serialport` in `C:\barrier\`)

`GET /api/hardware/trigger?device=barrier` intentionally returns 400 — barrier cannot be pinged server-side. The `/hardware` dashboard ping buttons for barrier call `triggerBarrierClient()` directly.

### UI Stack

- Tailwind CSS v4 with inline `style=` for brand colours (blue `#1D4ED8`, custom per-context)
- shadcn/ui primitives under `src/components/ui/` — Dialog, Button, Input, Label, Card, Toast
- Lucide React for icons
- Recharts for dashboard charts
- Custom `useToast()` hook from `src/components/ui/Toast.tsx`
- **Noto Sans Thai** loaded via `<link>` in `layout.tsx` (Google Fonts CDN), **not** via `next/font/google` — Turbopack on Vercel cannot handle multi-weight `next/font` for this font family. Do not revert to `next/font` for Noto Sans Thai.
