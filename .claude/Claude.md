# CLAUDE.md — VaultTrip

For full codebase reference, see ARCHITECTURE.md before reading individual files.

This file is the source of truth for how Claude Code should behave across every session on this project. Read it fully before writing any code.

---

## Project Overview

**VaultTrip** is a travel document management SaaS. Travelers upload passports, visas, insurance PDFs, hotel bookings, and vaccination records. VaultTrip organises them per trip, auto-generates destination-specific document checklists, tracks expiry dates, and works offline at airports and borders.

**Web app now. Expo React Native app later.** The same backend API must serve both. This is the single most important architectural constraint.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Auth | Clerk v5 |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| File Storage | AWS S3 (presigned URLs, AES-256 at rest) |
| Queue / Jobs | BullMQ + Redis |
| AI | Anthropic SDK (Claude) |
| Email | Resend |
| Logging | pino with secret redaction |
| Testing | Vitest |
| Deployment | Railway or Render |

---

## Non-Negotiable Architecture Rules

### 1. API-First — No Prisma in Pages or Layouts
**Never** import Prisma or query the database directly from page components, layout files, or client components. All data access must go through `/api/` route handlers. The Expo app will consume these same endpoints — a direct Prisma import in a page breaks that contract permanently.

```
✅  page.tsx → fetch('/api/trips')  → route.ts → prisma.trip.findMany()
❌  page.tsx → import prisma → prisma.trip.findMany()
```

### 2. Mobile-First UI
- Bottom tab bar on mobile (≤768px), not a hamburger drawer
- Minimum 44×44px touch targets on all interactive elements
- Safe area insets for iPhone home indicator (`pb-safe`, `env(safe-area-inset-bottom)`)
- PWA manifest + `next-pwa` config from day one

### 3. Presigned URLs Only — Never Public S3 URLs
Files are served via short-lived presigned URLs (15-minute expiry). No S3 object is ever made public. Never store a direct S3 URL in the database — store the `fileKey` only.

### 4. AI Processing is Async
Document parsing happens in a BullMQ worker, not in the upload API route. The upload route: accepts the file, writes to S3, creates a `Document` row with `aiProcessed: false`, enqueues the job, returns 201. The worker does the AI call and updates the row.

### 5. Environment Variables are Validated at Boot
All env vars must be declared in `src/env.ts` using `zod`. The app must fail fast at startup if any required var is missing — not at runtime when a user hits the feature.

---

## Code Standards

### TypeScript
- `strict: true` in `tsconfig.json` — no exceptions
- No `any` — use `unknown` and narrow, or define a proper type
- All API route handlers must have explicit return type annotations
- Zod for all external data validation (API inputs, env vars, AI responses)

### File & Folder Structure
```
src/
  app/                  # Next.js App Router pages and layouts
    (auth)/             # Clerk-protected route group
    (public)/           # Unauthenticated routes (landing, shared trip links)
    api/                # All API routes — the only place Prisma is used
  components/
    ui/                 # Primitive components (Button, Input, Badge, etc.)
    trips/              # Trip-specific compound components
    documents/          # Document vault components
    checklist/          # Checklist engine components
    layout/             # Shell, nav, tab bar
  lib/
    prisma.ts           # Singleton Prisma client
    redis.ts            # BullMQ Redis connection
    s3.ts               # S3 client + presigned URL helpers
    ai.ts               # Anthropic SDK client
    logger.ts           # pino logger instance
  workers/              # BullMQ worker definitions (run separately)
  env.ts                # Zod-validated env — import this, not process.env directly
  types/                # Shared TypeScript types (not Prisma-generated)
```

### Naming Conventions
- Files: `kebab-case.ts` / `kebab-case.tsx`
- Components: `PascalCase`
- Functions and variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Prisma model fields: `camelCase` (matches schema)
- API routes: RESTful nouns (`/api/trips`, `/api/trips/[id]/documents`)

### Logging
- Use `src/lib/logger.ts` (pino) for all server-side logging — never `console.log` in production paths
- Redact: `authorization`, `cookie`, `password`, `fileKey`, `docNumber`
- Log levels: `error` for caught exceptions, `warn` for recoverable issues, `info` for significant events, `debug` for dev-only tracing

### Error Handling
- API routes must return consistent error shapes: `{ error: string, code?: string }`
- Never leak stack traces or internal messages to API responses
- Use HTTP status codes correctly: 400 validation, 401 unauthenticated, 403 unauthorised, 404 not found, 409 conflict, 422 unprocessable, 500 server error

### Testing
- Vitest for unit and integration tests
- Test files co-located: `foo.ts` → `foo.test.ts`
- AI calls must be mockable — always inject the Anthropic client, never import it directly in workers

---

## Security Non-Negotiables

- Files encrypted at rest (AES-256) — configured at the S3 bucket level
- Presigned URLs expire in 15 minutes
- No document content in the database — metadata only
- AI processing receives an encrypted copy; discard after extraction
- Clerk handles all auth — no custom session management
- Shared trip links: read-only, token-based (`shareToken`), revocable
- GDPR: implement full data export and deletion endpoints before launch

---

## Claude Code Efficiency Rules

- Before writing any code, state which file you are editing and why
- Make one logical change per tool call — don't batch unrelated edits
- After completing a task, run the relevant test (`vitest run`) and confirm it passes before marking done
- If a task requires a migration, generate it with `prisma migrate dev --name <descriptive-name>` — never edit migration files by hand
- If you are unsure about a requirement, ask before implementing — a wrong assumption costs more to undo than a clarifying question costs to ask
- Never remove a TODO comment without either implementing it or replacing it with a GitHub issue reference
- Keep the Tasks section of this file updated as you complete work

---

## Data Models (Prisma Schema)

```prisma
model User {
  id          String     @id @default(cuid())
  clerkId     String     @unique
  email       String     @unique
  nationality String?
  trips       Trip[]
  documents   Document[]
  createdAt   DateTime   @default(now())
}

model Trip {
  id            String          @id @default(cuid())
  userId        String
  user          User            @relation(fields: [userId], references: [id])
  name          String
  origin        String
  destination   String
  departureDate DateTime
  returnDate    DateTime?
  tripType      TripType        @default(TOURISM)
  documents     Document[]
  checklist     ChecklistItem[]
  shareToken    String?         @unique
  createdAt     DateTime        @default(now())
}

model Document {
  id          String       @id @default(cuid())
  userId      String
  tripId      String?
  user        User         @relation(fields: [userId], references: [id])
  trip        Trip?        @relation(fields: [tripId], references: [id])
  type        DocumentType
  name        String
  fileKey     String
  fileSize    Int
  mimeType    String
  expiryDate  DateTime?
  issueDate   DateTime?
  docNumber   String?
  issuedBy    String?
  aiProcessed Boolean      @default(false)
  createdAt   DateTime     @default(now())
}

model ChecklistItem {
  id          String          @id @default(cuid())
  tripId      String
  trip        Trip            @relation(fields: [tripId], references: [id])
  label       String
  description String?
  required    RequiredLevel
  status      ChecklistStatus @default(PENDING)
  documentId  String?
  createdAt   DateTime        @default(now())
}

enum DocumentType {
  PASSPORT
  VISA
  TRAVEL_INSURANCE
  FLIGHT_BOOKING
  HOTEL_BOOKING
  VACCINATION_RECORD
  TRAVEL_PERMIT
  IDENTITY_CARD
  OTHER
}

enum TripType {
  TOURISM
  BUSINESS
  TRANSIT
  STUDY
  WORK
}

enum RequiredLevel {
  REQUIRED
  RECOMMENDED
  OPTIONAL
}

enum ChecklistStatus {
  PENDING
  FULFILLED
  NOT_APPLICABLE
  FLAGGED
}
```

---

## AI Prompt Contracts

These prompts are the authoritative contracts for AI calls. Do not alter them without updating this file.

### Document Parser
```
Extract the following from this document image or PDF:
- Document type (passport/visa/insurance/booking/vaccination/identity_card/other)
- If type is "booking", also include bookingSubtype: "flight", "hotel", or "other"
- Expiry date (ISO 8601 format, or null)
- Issue date (ISO 8601 format, or null)
- Document number (or null)
- Issuing authority or country (or null)
- Full name on document (or null)

Return JSON only. No explanation. No markdown fences.
Schema: { type, bookingSubtype, expiryDate, issueDate, docNumber, issuedBy, fullName }
bookingSubtype is only required when type is "booking"; omit or set to null otherwise.
```

### Checklist Generator
```
Generate a travel document checklist for:
- Traveler nationality: [ISO country code]
- Destination: [ISO country code]
- Trip type: [tourism/business/transit/study/work]
- Duration: [n] days
- Departure date: [ISO date]

Return a JSON array only. No explanation. No markdown fences.
Each item: { label: string, description: string, required: "required" | "recommended" | "optional" }
```

### Email Booking Parser
```
Extract booking details from this email body:
- Booking type (flight/hotel/car/tour/other)
- Booking reference / confirmation number
- Travel dates (check-in / departure and check-out / return, ISO format)
- Destination city or country
- Provider or airline name

Return JSON only. No explanation. No markdown fences.
Schema: { bookingType, reference, startDate, endDate, destination, provider }
```

---

## Tasks

Track build progress here. Update status as work is completed.

### Phase 1 — Project Bootstrap & Backend Infrastructure
**Model: claude-opus-4-6 | Effort: max**

- [x] 1.1 Initialise Next.js 14 with TypeScript strict mode and Tailwind CSS
- [x] 1.2 Install and configure Clerk v5 middleware and webhook handler (svix)
- [x] 1.3 Zod-validated `src/env.ts` for all environment variables
- [x] 1.4 Pino logger with secret field redaction
- [x] 1.5 Prisma 7 singleton (`@prisma/adapter-pg`) with slow-query hook
- [x] 1.6 Full Prisma schema (4 models, 4 enums as above) + seed script
- [x] 1.7 Redis client + BullMQ queue definitions
- [x] 1.8 S3 client with presigned upload and download URL helpers
- [x] 1.9 PWA manifest + `next-pwa` config
- [x] 1.10 Vitest setup + passing smoke test

### Phase 2 — Core Frontend Shell
**Model: claude-sonnet-4-6 | Effort: medium**

- [x] 2.1 Root layout with Clerk `<ClerkProvider>` and Tailwind base styles
- [x] 2.2 Authenticated shell: bottom tab bar (mobile), sidebar (desktop ≥1024px)
- [x] 2.3 Tab bar items: Trips, Vault, Checklist, Profile (44px touch targets, safe area inset)
- [x] 2.4 Landing/sign-in page (`/`) — unauthenticated entry point
- [x] 2.5 Dashboard page (`/dashboard`) — placeholder, auth-protected
- [x] 2.6 Global loading and error boundary components
- [x] 2.7 Toast notification system (Sonner or Radix)
- [x] 2.8 Responsive typography scale in `tailwind.config.ts`

### Phase 3 — Document Vault
**Model: claude-opus-4-6 | Effort: high**

- [x] 3.1 `POST /api/documents/upload-url` — presigned URL generation (does not accept file directly)
- [x] 3.2 `GET /api/documents` — list user documents with filter by type and tripId
- [x] 3.3 `GET /api/documents/[id]` — single document metadata + fresh presigned download URL
- [x] 3.4 `DELETE /api/documents/[id]` — delete row + S3 object cleanup
- [x] 3.5 Document upload UI: drag-and-drop zone, file type validation, progress indicator
- [x] 3.6 Document card component: type icon, name, expiry badge (ok / expiring / expired)
- [x] 3.7 Document detail drawer: metadata display, download button, delete confirm
- [x] 3.8 Vault page (`/vault`): filterable grid of all user documents

### Phase 4 — AI Document Processing
**Model: claude-opus-4-6 | Effort: max**

- [x] 4.1 BullMQ `document-processing` queue and worker scaffold
- [x] 4.2 Worker: fetch file from S3, call Claude document parser, validate response with Zod
- [x] 4.3 Worker: update Document row with extracted metadata, set `aiProcessed: true`
- [x] 4.4 Worker: error handling — retry with backoff, dead-letter after 3 attempts
- [x] 4.5 Upload API route: enqueue job after S3 write (do not await AI result)
- [x] 4.6 Polling or SSE on document card to show "Processing…" → metadata when ready
- [x] 4.7 Vitest tests for parser Zod schema validation and worker logic (mocked AI client)

### Phase 5 — Trip Workspace
**Model: claude-opus-4-6 | Effort: high**

- [x] 5.1 `POST /api/trips` — create trip, trigger checklist generation job
- [x] 5.2 `GET /api/trips` — list user trips with document count and health score
- [x] 5.3 `GET /api/trips/[id]` — trip detail with documents and checklist
- [x] 5.4 `PATCH /api/trips/[id]` — update trip metadata
- [x] 5.5 `DELETE /api/trips/[id]` — delete trip and associated documents
- [x] 5.6 `POST /api/trips/[id]/checklist/generate` — (re)generate checklist via Claude
- [x] 5.7 `PATCH /api/trips/[id]/checklist/[itemId]` — update checklist item status or linked document
- [x] 5.8 BullMQ `checklist-generation` worker: call Claude, parse response, upsert ChecklistItems
- [x] 5.9 Trip creation flow UI: origin, destination, dates, trip type
- [x] 5.10 Trip detail page (`/trips/[id]`): document list + checklist side by side
- [x] 5.11 Trip health score component: "7 of 9 documents present" with visual indicator
- [x] 5.12 `GET /api/trips/[id]/share` — generate or return `shareToken`
- [x] 5.13 Public shared trip page (`/shared/[token]`) — read-only, no auth required

### Phase 6 — Expiry Alerts
**Model: claude-sonnet-4-6 | Effort: medium**

- [x] 6.1 BullMQ `expiry-check` repeatable job — runs daily at 08:00 UTC
- [x] 6.2 Alert logic: passport (12 months), visa (30 days), insurance (7 days before trip)
- [x] 6.3 Resend email templates: expiry warning, trip readiness reminder
- [ ] 6.4 `POST /api/webhooks/resend` — delivery event logging
- [x] 6.5 Alert preferences UI in Profile page: toggles per alert type
- [x] 6.6 `PATCH /api/users/me/preferences` — persist alert preferences

### Phase 7 — Gmail Integration
**Model: claude-opus-4-6 | Effort: max**

- [ ] 7.1 Gmail OAuth flow via Clerk OAuth or direct Google OAuth
- [ ] 7.2 `POST /api/gmail/connect` — store refresh token (encrypted)
- [ ] 7.3 BullMQ `gmail-sync` worker: fetch unread emails, filter travel-adjacent senders
- [ ] 7.4 Worker: call Claude email parser on each candidate email body
- [ ] 7.5 Worker: create Document rows for detected bookings, attempt trip auto-linking
- [ ] 7.6 `GET /api/gmail/pending` — list parsed bookings awaiting user review
- [ ] 7.7 Gmail import review UI: accept / reject / reassign to trip

### Phase 8 — PWA + Offline Mode
**Model: claude-sonnet-4-6 | Effort: medium**

- [ ] 8.1 `next-pwa` service worker: cache static assets and shell routes
- [ ] 8.2 On trip creation: pre-cache all associated document presigned URLs
- [ ] 8.3 Offline document viewer: display cached file with "Offline mode" banner
- [ ] 8.4 Offline detection hook + UI indicator in shell header
- [ ] 8.5 PWA install prompt component (iOS and Android)
- [ ] 8.6 Test offline flow end-to-end: disconnect network, navigate to trip, open document

---

## Monetisation Limits (enforce in API layer)

| Plan | Trips | Documents | Gmail Sync | Family |
|---|---|---|---|---|
| Free | 3 | 10 | No | No |
| Traveler ($6/mo) | Unlimited | 100 | Yes | No |
| Frequent ($12/mo) | Unlimited | Unlimited | Yes | 5 members |
| Lifetime ($79) | Unlimited | Unlimited | Yes | 5 members |

Enforce limits in the `POST /api/trips` and `POST /api/documents/upload` route handlers before any S3 or DB write. Return `402` with `{ error: "Plan limit reached", code: "LIMIT_TRIPS" }`.