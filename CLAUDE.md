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

## Architecture

### Route Groups

Two separate UX contexts inside `src/app/`:

| Group | Path prefix | Audience |
|-------|------------|----------|
| `(dashboard)` | `/dashboard`, `/settings`, `/reports`, etc. | Admin / manager — full sidebar layout |
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
| `Discount` | discountType (`fixed`/`percent`), discountValue, maxDiscount |
| `SystemSettings` | singleton — one document only, fetched via `getSettings()` |
| `HardwareLog` | device, action, success |

### SystemSettings Singleton

`getSettings()` in `src/models/SystemSettings.ts` returns the single settings document, creating it with defaults if absent. Always use `getSettings()` rather than querying directly.

Key sub-objects:
- `businessHours` — `{ open: 'HH:MM', close: 'HH:MM' }`
- `capacity` — `{ car: number, motorcycle: number }`
- `rates.overnight` — `{ windowStart, windowEnd, flatRate, extraHour }` — drives all overnight fee logic
- `hardware` — per-device `{ ip, port, endpoint, enabled }`

### Fee Calculation (`src/lib/calcFee.ts`)

`calcFeeBreakdown(cardType, entryTime, exitTime, overnightConfig?)` — returns `{ segments, total }` where each segment has `kind: 'normal' | 'outside' | 'overnight'`.

`calcFeeFromMinutes(type, minutes, entryTime?, exitTime?, overnightConfig?)` — convenience wrapper; delegates to `calcFeeBreakdown` when entry/exit times are supplied.

**Overnight logic**: if a stay spans the configured overnight window (default 18:00–07:00), it switches to overnight mode. Each overnight window crossed costs `flatRate`. Time outside all windows costs `ceil(minutes/60) × extraHour` — ceiled per segment, not in aggregate.

Always pass `settings.rates.overnight` from DB into these functions (checkout API does this). The default config in the file is a fallback for the operator page's live preview only.

### API Conventions

- Every route file starts with `await connectDB()`
- Auth token read via `const token = (await cookies()).get(COOKIE_NAME)?.value`
- Settings fetched with `await getSettings()`
- Checkin API accepts optional `entryTime` (ISO string) for backdating — used by simulator/testing

### Simulator (`/simulator`)

Dev tool page — not behind a role guard. Two features:
1. **Fee Calculator** — client-side only, calls `calcFeeBreakdown` directly, no DB writes
2. **Batch Seed** — `POST /api/simulate` creates `ParkingSession` records with `isSimulated: true`; `DELETE /api/simulate` wipes them all

### Hardware Integration (`src/lib/hardware.ts`)

Fire-and-forget HTTP calls to physical devices (camera, barrier, printer, drawer). Triggered after checkin/checkout. Enabled per-device via `settings.hardware[device].enabled`.

### UI Stack

- Tailwind CSS v4 with inline `style=` for brand colours (blue `#1D4ED8`, custom per-context)
- shadcn/ui primitives under `src/components/ui/` — Dialog, Button, Input, Label, Card, Toast
- Lucide React for icons
- Recharts for dashboard charts
- Custom `useToast()` hook from `src/components/ui/Toast.tsx`

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
    - calcFeeFromMinutes with overnight config from DB
    - applies discount if discountId provided
    - updates session { status: 'completed', exitTime, totalFee }
    - increments shift.checkoutsCount + cashAmount/qrAmount
```

Lost card flow: `POST /api/sessions/lost` — creates a completed session with `lostFine = settings.lostCardFine` added to fee.

Queue activates automatically when `stats.availableSlots === 0`. `POST /api/queue/{id}/enter` promotes a queued car to an active session.
