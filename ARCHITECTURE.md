# ARCHITECTURE.md — VaultTrip Codebase Reference

> **Purpose:** A complete, self-contained snapshot of the VaultTrip codebase as of 2026-06-16. A future Claude Code session should be able to read *this single file* and understand the whole project without opening any other file. When code changes, update this file.
>
> **Companion file:** `.claude/CLAUDE.md` holds the behavioural rules, product spec, AI prompt contracts, monetisation limits, and the phased task list. This file documents *what currently exists in code*. Where the two disagree, this file describes reality and flags the deviation under "Known Decisions & Trade-offs".

---

## 1. Project Summary

VaultTrip is a travel-document management SaaS. Travelers upload passports, visas, insurance, bookings, and vaccination records. The app organises them per trip, auto-generates destination-specific checklists via Claude, tracks expiry dates, and (planned) works offline as a PWA.

**Hard architectural constraint:** the same backend API must serve both the current Next.js web app and a future Expo React Native app. Therefore **all data access goes through `/api/` route handlers** — Prisma is never imported into pages, layouts, or client components.

**Build status:** Phases 1–6 complete (bootstrap, frontend shell, document vault, AI processing, trip workspace, expiry alerts). Phases 7–8 (Gmail integration, PWA/offline) are not yet implemented. The Dashboard page is a placeholder; the Profile page shows alert preference toggles.

---

## 2. Stack & Versions

From `package.json`:

| Layer | Package | Version | Notes |
|---|---|---|---|
| Framework | `next` | 14.2.35 | App Router |
| Language | `typescript` | ^5 | `strict: true`, `noUncheckedIndexedAccess: true` |
| UI | `react` / `react-dom` | ^18 | |
| Styling | `tailwindcss` | ^3.4.1 | custom dark theme (see §11) |
| Auth | `@clerk/nextjs` | ^5.7.6 | middleware + webhook (svix) |
| ORM | `@prisma/client` + `prisma` | ^7.8.0 | **driver-adapter mode** |
| DB adapter | `@prisma/adapter-pg` | ^7.8.0 | wraps `pg` |
| Postgres driver | `pg` | ^8.21.0 | |
| Queue | `bullmq` | ^5.78.1 | |
| Redis client | `ioredis` | ^5.10.1 | pinned; BullMQ requires it |
| S3 | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | ^3.1069.0 | |
| AI | `@anthropic-ai/sdk` | ^0.104.2 | |
| Email | `resend` | ^6.12.4 | installed, not yet wired up |
| Logging | `pino` + `pino-pretty` | ^10.3.1 / ^13.1.3 | secret redaction |
| Validation | `zod` | ^4.4.3 | env, API inputs, AI responses |
| Webhooks | `svix` | ^1.95.2 | Clerk webhook verification |
| Toasts | `sonner` | ^2.0.7 | |
| Icons | `lucide-react` | ^1.18.0 | |
| Class utils | `clsx` + `tailwind-merge` | ^2.1.1 / ^3.6.0 | via `cn()` |
| PWA | `next-pwa` | ^5.6.0 | configured, icons missing (see §13) |
| Testing | `vitest` | ^4.1.9 | + `@vitejs/plugin-react`, `vite-tsconfig-paths` |
| Worker runtime | `tsx` | ^4.22.4 | runs workers as standalone process |
| Env loading | `dotenv` | ^17.4.2 | for worker + Prisma CLI |

**Scripts** (`package.json`):
- `dev` / `build` / `start` — Next.js
- `lint` — `next lint`
- `test` — `vitest run`; `test:watch` — `vitest`
- `worker:dev` — `tsx watch src/workers/document-processor.ts`
- `worker:start` — `tsx src/workers/document-processor.ts`
- `db:generate` — `prisma generate`; `db:migrate` — `prisma migrate dev`; `db:seed` — `prisma db seed`

**Config files (root):**
- `next.config.js` — CommonJS, wraps config with `next-pwa` (`dest: 'public'`, `register`, `skipWaiting`, disabled in dev). *(Replaces the original `next.config.mjs`, which was deleted.)*
- `tsconfig.json` — strict, `noUncheckedIndexedAccess`, `moduleResolution: bundler`, path alias `@/* → ./src/*`.
- `tailwind.config.ts` — custom theme (§11).
- `prisma.config.ts` — loads `.env.local`, schema path, migrations path, seed command (`node --experimental-strip-types prisma/seed.ts`).
- `vitest.config.ts` — `environment: node`, `globals: true`, setup `./vitest.setup.ts`, tsconfig-paths plugin.
- `postcss.config.mjs`, `.eslintrc.json` (extends `next/core-web-vitals`).

---

## 3. Folder Structure

```
VaultTrip/
├── ARCHITECTURE.md            # this file
├── next.config.js             # Next + next-pwa wrapper
├── prisma.config.ts           # Prisma CLI config (loads .env.local)
├── tailwind.config.ts         # custom dark theme + type scale
├── tsconfig.json              # strict TS, @/* alias
├── vitest.config.ts / vitest.setup.ts
├── public/
│   └── manifest.json          # PWA manifest (icons referenced but not present)
├── prisma/
│   ├── schema.prisma          # 4 models, 4 enums (§4)
│   └── seed.ts                # demo user + Thailand trip + 4 checklist items
└── src/
    ├── middleware.ts          # Clerk route protection; public-route matcher
    ├── env.ts                 # Zod-validated env (parsed at import)
    ├── app/
    │   ├── layout.tsx         # root: ClerkProvider, Inter font, Sonner Toaster, PWA metadata/viewport
    │   ├── globals.css        # Tailwind layers + safe-area utilities + focus-visible ring
    │   ├── favicon.ico, fonts/ (GeistVF.woff, GeistMonoVF.woff — present, unused; Inter loaded via next/font)
    │   ├── (auth)/            # Clerk-protected route group
    │   │   ├── layout.tsx     # app shell: Sidebar (desktop) + Header + TabBar (mobile) + UserButton
    │   │   ├── loading.tsx    # full-height Spinner
    │   │   ├── error.tsx      # error boundary with reset button
    │   │   ├── dashboard/page.tsx   # PLACEHOLDER (EmptyState)
    │   │   ├── profile/page.tsx     # PLACEHOLDER (EmptyState)
    │   │   ├── trips/page.tsx       # server fetch /api/trips → <TripsClient>
    │   │   ├── trips/[id]/page.tsx  # server fetch /api/trips/[id] → <TripDetailClient>; notFound on 403/404
    │   │   └── vault/page.tsx       # server fetch /api/documents → <VaultClient>
    │   ├── (public)/          # unauthenticated routes
    │   │   ├── layout.tsx     # pass-through fragment
    │   │   ├── page.tsx       # marketing landing page
    │   │   └── shared/[token]/page.tsx  # read-only shared trip checklist (no auth)
    │   ├── sign-in/[[...sign-in]]/page.tsx   # Clerk <SignIn>
    │   ├── sign-up/[[...sign-up]]/page.tsx   # Clerk <SignUp>
    │   └── api/              # THE ONLY PLACE PRISMA IS USED (§5)
    │       ├── documents/route.ts                 # GET list
    │       ├── documents/[id]/route.ts            # GET detail+presigned, DELETE
    │       ├── documents/upload-url/route.ts      # POST presigned upload + create row + enqueue
    │       ├── trips/route.ts                     # GET list, POST create (+ route.test.ts)
    │       ├── trips/[id]/route.ts                # GET detail, PATCH, DELETE
    │       ├── trips/[id]/share/route.ts          # GET (get-or-create shareToken)
    │       ├── trips/[id]/checklist/generate/route.ts      # POST enqueue regen
    │       ├── trips/[id]/checklist/[itemId]/route.ts      # PATCH item status/link
    │       ├── shared/[token]/route.ts            # GET public shared trip (no auth)
    │       ├── users/me/preferences/route.ts     # GET + PATCH alert preferences
    │       └── webhooks/clerk/route.ts            # POST svix-verified user.created/deleted
    ├── components/
    │   ├── ui/               # primitives: button, spinner, empty-state
    │   ├── layout/           # sidebar, tab-bar, header, nav-config
    │   ├── documents/        # vault-client, upload-zone, document-card, -detail-drawer, -type-icon, expiry-badge
    │   └── trips/            # trips-client, trip-card, trip-detail-client, create-trip-modal, country-select, checklist-panel, health-score-ring
    ├── lib/
    │   ├── prisma.ts         # singleton PrismaClient w/ PrismaPg adapter + slow-query hook
    │   ├── redis.ts          # ioredis singleton (maxRetriesPerRequest: null)
    │   ├── queues.ts         # 4 BullMQ Queue definitions (incl. send-alert)
    │   ├── s3.ts             # S3 client + presigned upload/download + delete + buildFileKey
    │   ├── ai.ts             # Anthropic client singleton
    │   ├── logger.ts         # pino w/ redaction
    │   ├── resend.ts         # Resend client singleton + 4 email template functions
    │   ├── alert-rules.ts    # pure alert eligibility functions (no side effects)
    │   ├── current-user.ts   # getCurrentUser() — Clerk session → User row
    │   ├── documents.ts      # upload validation (pure), MIME allowlist, size + plan limits
    │   ├── countries.ts      # 196 ISO countries + getCountryName()
    │   ├── utils.ts          # cn(), formatFileSize(), formatDate()
    │   └── toast.ts          # thin wrapper over sonner
    ├── types/
    │   ├── document.ts       # DocumentDTO, DocumentDetailDTO, toDocumentDTO()
    │   └── trip.ts           # TripDTO, TripDetailDTO, ChecklistItemDTO, computeHealthScore()
    └── workers/
        ├── load-env.ts            # dotenv .env.local loader (imported first)
        ├── document-processor.ts  # BullMQ Worker entry point (all 4 queues + repeatable job registration)
        ├── document-processing.ts # pure processDocument() logic + Zod parser
        ├── checklist-generation.ts# pure generateChecklist() logic + Zod parser
        └── expiry-alerts.ts       # pure runExpiryCheck() + sendAlert() — injectable deps
```

**Co-located tests:** `lib/utils.test.ts`, `lib/documents.test.ts`, `lib/logger.test.ts`, `lib/s3.test.ts`, `types/trip.test.ts`, `workers/document-processing.test.ts`, `workers/checklist-generation.test.ts`, `app/api/trips/route.test.ts`.

---

## 4. Data Models

### Prisma schema (`prisma/schema.prisma`)

Generator `prisma-client-js`; datasource `postgresql`. The connection string is supplied at runtime through the `@prisma/adapter-pg` driver adapter (no `url` in the datasource block).

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
  fileKey     String        // S3 object key — never exposed to clients
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
  documentId  String?         // soft link to a Document (no FK relation)
  createdAt   DateTime        @default(now())
}

enum DocumentType  { PASSPORT VISA TRAVEL_INSURANCE FLIGHT_BOOKING HOTEL_BOOKING VACCINATION_RECORD TRAVEL_PERMIT IDENTITY_CARD OTHER }
enum TripType      { TOURISM BUSINESS TRANSIT STUDY WORK }
enum RequiredLevel { REQUIRED RECOMMENDED OPTIONAL }
enum ChecklistStatus { PENDING FULFILLED NOT_APPLICABLE FLAGGED }

// Phase 6 additions:
model UserPreferences {
  id              String  @id @default(cuid())
  userId          String  @unique
  user            User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  alertPassport   Boolean @default(true)
  alertVisa       Boolean @default(true)
  alertInsurance  Boolean @default(true)
  alertTripHealth Boolean @default(true)
}

model AlertSentLog {
  id        String   @id @default(cuid())
  userId    String
  entityId  String   // documentId or tripId
  alertType String   // 'PASSPORT_EXPIRY' | 'VISA_EXPIRY' | 'INSURANCE_COVERAGE' | 'TRIP_HEALTH'
  sentAt    DateTime @default(now())

  @@index([entityId, alertType, sentAt])
}
```

> **No migrations directory exists yet.** `prisma.config.ts` points migrations at `prisma/migrations`, but the folder hasn't been generated — the schema has only been used via `db push`/seed so far. Generate the first migration with `prisma migrate dev --name init` before deploy.

### DTO types (`src/types/`)

DTOs are the API-boundary contract. Dates are serialised to ISO strings; `fileKey` is **never** included.

**`document.ts`:**
```ts
interface DocumentDTO {
  id, tripId: string|null, type: DocumentType, name, fileSize: number,
  mimeType, expiryDate: string|null, issueDate: string|null,
  docNumber: string|null, issuedBy: string|null, aiProcessed: boolean, createdAt: string
}
interface DocumentDetailDTO extends DocumentDTO { downloadUrl: string }  // presigned, 15-min
toDocumentDTO(doc: Document): DocumentDTO   // strips fileKey/userId, ISO-serialises dates
```

**`trip.ts`:**
```ts
interface ChecklistItemDTO { id, tripId, label, description: string|null, required: RequiredLevel, status: ChecklistStatus, documentId: string|null, createdAt: string }
interface TripHealthScore  { fulfilled: number, total: number, percent: number|null }
interface TripDTO {
  id, name, origin, destination, departureDate, returnDate: string|null, tripType,
  shareToken: string|null, createdAt, documentCount: number,
  checklistCounts: { fulfilled, pending, flagged, notApplicable },
  healthScore: TripHealthScore
}
interface TripDetailDTO extends TripDTO { documents: DocumentDTO[], checklist: ChecklistItemDTO[] }
computeHealthScore(items): TripHealthScore  // fulfilled REQUIRED / total REQUIRED; percent null when no required items
```

---

## 5. API Surface

All routes return the error shape `{ error: string, code?: string }`. Auth uses `getCurrentUser()` which returns `{ id } | null`; `null` → 401. Ownership is checked per-row (compare `row.userId` to `user.id` → 404 for documents, 403 for trips). All Prisma access lives here.

### Documents

| Route | Method | Auth | Accepts | Returns | Notes |
|---|---|---|---|---|---|
| `/api/documents` | GET | Yes | query `?tripId=`, `?type=` (validated against `DocumentType`) | `{ documents: DocumentDTO[] }` | Scoped to user; ordered `createdAt desc`. Invalid `type` → 400 `VALIDATION_ERROR`. |
| `/api/documents/[id]` | GET | Yes | — | `DocumentDetailDTO` (with fresh presigned `downloadUrl`) | 404 if not found or not owner. |
| `/api/documents/[id]` | DELETE | Yes | — | `{ success: true }` | Deletes S3 object **then** DB row. 404 if not owner. |
| `/api/documents/upload-url` | POST | Yes | `{ filename(1-255), mimeType, fileSize(int>0), tripId? }` | `201 { documentId, uploadUrl }` | See upload flow below. |

**Upload-url flow** (the two-step pattern, §10): validate body (Zod) → `validateUpload()` (MIME allowlist + 20 MB cap → 422) → enforce `FREE_DOCUMENT_LIMIT` (10) via `count` → **402 `LIMIT_DOCUMENTS`** → `buildFileKey()` → presigned PUT URL → create `Document` row (`type: OTHER`, `aiProcessed: false`) → enqueue `document-processing` job (enqueue failure is logged, **not** fatal — upload still returns 201) → return `{ documentId, uploadUrl }`. Client then PUTs the file directly to S3.

### Trips

| Route | Method | Auth | Accepts | Returns | Notes |
|---|---|---|---|---|---|
| `/api/trips` | GET | Yes | — | `{ trips: TripDTO[] }` | Ordered `departureDate asc`; includes doc count + checklist counts + health score. |
| `/api/trips` | POST | Yes | `{ name(1-120), origin(2-letter), destination(2-letter), departureDate(ISO, not past), returnDate?, tripType? }` | `201 { trip: TripDTO }` | Enforces `FREE_TRIP_LIMIT` (3) → **402 `LIMIT_TRIPS`**. Enqueues `checklist-generation`. Country codes upper-cased. |
| `/api/trips/[id]` | GET | Yes | — | `{ trip: TripDetailDTO }` | 404 not found, 403 not owner. Checklist ordered `required asc, createdAt asc`. |
| `/api/trips/[id]` | PATCH | Yes | `{ name?, returnDate?, tripType? }` | `{ trip: { id } }` | Partial update. 404/403 guarded. |
| `/api/trips/[id]` | DELETE | Yes | — | `{ ok: true }` | Transaction: unlink documents (`tripId → null`, kept in vault), delete checklist items, delete trip. |
| `/api/trips/[id]/share` | GET | Yes | — | `{ shareToken }` | Get-or-create: returns existing token or generates `crypto.randomUUID()`. |
| `/api/trips/[id]/checklist/generate` | POST | Yes | — | `202 { ok: true }` | Enqueues `checklist-generation` (regenerate). 404/403 guarded. |
| `/api/trips/[id]/checklist/[itemId]` | PATCH | Yes | `{ status?, documentId? }` | `{ item: ChecklistItemDTO }` | Verifies trip ownership, item belongs to trip, and (if set) `documentId` belongs to user. |

### Public / Webhooks

| Route | Method | Auth | Accepts | Returns | Notes |
|---|---|---|---|---|---|
| `/api/shared/[token]` | GET | **None** | — | `{ trip: SharedTripDTO }` | Looks up by `shareToken`. Returns only name/destination/dates + checklist (id/label/description/required/status). No documents, no fileKeys. 404 if token invalid. |
| `/api/webhooks/clerk` | POST | svix sig | Clerk event | `{ received: true }` | Verifies `svix-id/timestamp/signature` with `CLERK_WEBHOOK_SECRET`. `user.created` → create User row; `user.deleted` → `deleteMany` by clerkId. Missing headers/bad sig → 400. |

### User Preferences (Phase 6)

| Route | Method | Auth | Accepts | Returns | Notes |
|---|---|---|---|---|---|
| `/api/users/me/preferences` | GET | Yes | — | `PreferencesDTO` | Upserts defaults if no row exists. |
| `/api/users/me/preferences` | PATCH | Yes | `{ alertPassport?, alertVisa?, alertInsurance?, alertTripHealth? }` (all optional booleans) | `PreferencesDTO` | `.strict()` Zod schema rejects unknown fields → 400. Upserts. |

`PreferencesDTO = { alertPassport: boolean, alertVisa: boolean, alertInsurance: boolean, alertTripHealth: boolean }`

---

## 6. Worker Architecture

**Process model:** Workers run as a **standalone Node process**, not inside Next.js. Single entry point `src/workers/document-processor.ts` hosts BullMQ `Worker`s for all four queues. Run locally with `npm run worker:dev` (tsx watch) or `npm run worker:start`.

`src/workers/load-env.ts` is imported first in the entry point — it calls `dotenv.config({ path: '.env.local' })` so `@/env` (which validates at import) has its variables when running outside Next.

**Redis connections:** each worker calls `redis.duplicate()` from the shared `ioredis` client — BullMQ issues blocking commands, so workers must not share the app's connection. The base client is configured `maxRetriesPerRequest: null`, `enableReadyCheck: false` (BullMQ requirements).

**Queues** (`src/lib/queues.ts`), all connected to the shared `redis`:

| Queue | `attempts` | backoff | removeOnComplete / Fail | Worker concurrency |
|---|---|---|---|---|
| `document-processing` | 3 | exponential, 5000ms | 100 / 500 | 5 |
| `checklist-generation` | 3 | exponential, 3000ms | 100 / 500 | 3 |
| `expiry-check` | 2 | (none) | 10 / 100 | 1 |
| `send-alert` | 3 | exponential, 10000ms | 50 / 200 | 5 |

**Job payloads:**
- `document-processing` → `{ documentId: string, userId: string }` (job name `process-document`)
- `checklist-generation` → `{ tripId: string, userId: string }` (job name `generate-checklist`)
- `expiry-check` → `{}` (job name `run-expiry-check`; added as a repeatable job at `cron: '0 8 * * *'`)
- `send-alert` → `SendAlertJobData` discriminated union (see §6 below; job name `send-alert`)

The entry point registers `completed` / `failed` / `error` listeners (structured logging incl. `attemptsMade`) and a `SIGTERM`/`SIGINT` shutdown that closes all four workers and all four duplicated connections before `process.exit(0)`.

### Expiry alert flow (Phase 6)

Scheduler (`src/workers/expiry-alerts.ts` — `runExpiryCheck`):
1. Query passports with `expiryDate` in `(now, now + 365d]`.
2. Query visas with `expiryDate` in `(now, now + 30d]`.
3. Query trips with `departureDate` in `(now, now + 7d]`; include linked `TRAVEL_INSURANCE` documents and checklist items.
4. For each match, check `AlertSentLog` for a record with `entityId + alertType + sentAt >= startOfDayUTC(now)` — skip if found (dedup, one alert per entity per type per day).
5. Enqueue a `send-alert` job with the relevant data pre-fetched (recipient email, entity names, dates).

Sender (`sendAlert`):
1. Look up `UserPreferences` — return early (no email, no log) if the relevant toggle is `false`.
2. Build email HTML from one of the four template functions in `src/lib/resend.ts`.
3. Call `resend.emails.send(...)`.
4. Write an `AlertSentLog` row to mark the alert as sent.

**Dedup strategy:** `AlertSentLog` table (see §4) — checked by scheduler before enqueue. Sender writes the log row after successful send. Window is `sentAt >= UTC midnight of current day`. Choice: simplest approach that prevents duplicate sends per day without requiring transactions; a brief TOCTOU window exists between scheduler check and sender write but is harmless given the once-daily cron.

**Failure semantics:** a job throws → BullMQ retries per the queue's `attempts`/backoff; after the final attempt it's dead-lettered (kept under `removeOnFail`). Non-error "discard" cases (document/trip missing, already processed, user mismatch) `return` cleanly so the job is **not** retried.

---

## 7. AI Integration

**Client:** `src/lib/ai.ts` — `export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })`.

**Model:** both parsers use `claude-opus-4-6` (constants `DOCUMENT_PARSER_MODEL` / `CHECKLIST_GENERATOR_MODEL`). Document parser `max_tokens: 1024`; checklist generator `max_tokens: 2048`.

> Note: `claude-opus-4-6` is the model string hard-coded in the workers. The latest available Opus is **claude-opus-4-8** — consider bumping when revisiting AI quality.

### Injectable-deps pattern (testability)

Neither worker imports the Anthropic/Prisma/S3 clients directly into its callable function. Each exposes a pure function with a `deps` parameter defaulting to production clients:

```ts
processDocument(data, deps = defaultDeps)   // deps: { prisma, anthropic, getDownloadUrl, fetchFile }
generateChecklist(data, deps = defaultDeps) // deps: { prisma, anthropic }
```

Tests pass mock `deps`; the BullMQ entry point calls with defaults. This keeps the core logic free of BullMQ/Redis imports so it's unit-testable without a running queue.

### Document Parser (`src/workers/document-processing.ts`)

Prompt (`DOCUMENT_PARSER_PROMPT`, must stay in lock-step with CLAUDE.md):
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

The file is sent as a base64 content block: PDFs as a `document` block, images as an `image` block (`buildFileContentBlock`).

Zod schema `documentParserSchema`:
```ts
{
  type: enum['passport','visa','insurance','booking','vaccination','identity_card','other'],  // required
  bookingSubtype: enum['flight','hotel','other'] | null,   // optional → null
  expiryDate: coerced Date | null,   // z.null() precedes z.coerce.date() — new Date(null) would coerce to epoch
  issueDate:  coerced Date | null,
  docNumber:  trimmed string | null, // empty → null
  issuedBy:   trimmed string | null,
  fullName:   trimmed string | null,
}
```

Response handling: `stripMarkdownFences()` removes a wrapping ```` ```json ```` fence → `JSON.parse` → `safeParse`. Any failure logs the raw response and **throws** (so BullMQ retries). `mapParserTypeToDocumentType()` maps the parser vocabulary → Prisma `DocumentType` (`booking`+`flight`→`FLIGHT_BOOKING`, `booking`+`hotel`→`HOTEL_BOOKING`, else `OTHER`; `insurance`→`TRAVEL_INSURANCE`, `vaccination`→`VACCINATION_RECORD`, etc.). On success: update the row with `type`, `expiryDate`, `issueDate`, `docNumber`, `issuedBy`, `aiProcessed: true`. Discards (no error) if document missing or already `aiProcessed`.

### Checklist Generator (`src/workers/checklist-generation.ts`)

Prompt (`CHECKLIST_GENERATOR_PROMPT(nationality, destination, tripType, durationDays, departureDate)`):
```
Generate a travel document checklist for:
- Traveler nationality: [nationality]
- Destination: [destination]
- Trip type: [tourism/business/...]   (lower-cased)
- Duration: [n] days
- Departure date: [ISO date]

Return a JSON array only. No explanation. No markdown fences.
Each item: { label: string, description: string, required: "required" | "recommended" | "optional" }
```

Inputs derived from the trip: `nationality` from `user.nationality` (defaults `'US'`); `durationDays` = ceil((returnDate − departureDate)/86_400_000), min 1, defaults 7 when no return date; `departureDate` sliced to `YYYY-MM-DD`.

Zod schema: `checklistResponseSchema = z.array({ label: string≥1, description: string, required: enum['required','recommended','optional'] })`. Same strip-fence → parse → safeParse → throw-on-failure flow. **Idempotent persistence:** `deleteMany({ tripId })` then `createMany(...)`, mapping `required` → `RequiredLevel` enum (fallback `OPTIONAL`). Discards if trip missing or `trip.userId !== userId`.

---

## 8. UI Component Map

All components are dark-themed (Tailwind tokens, §11). `"use client"` components are noted.

### `components/ui/` — primitives
- **button.tsx** — `Button` (forwardRef). Props: `variant` (`primary`|`secondary`|`ghost`|`danger`), `size` (`sm`|`md`|`lg`), `loading`, plus native button attrs. Renders `Spinner` when loading; min heights 8/11/12 (touch-friendly).
- **spinner.tsx** — `Spinner`. Props: `size` (`sm`|`md`|`lg`), `className`. Accessible spinning ring (`role=status`).
- **empty-state.tsx** — `EmptyState`. Props: `icon?`, `title`, `description`, `action?`, `className?`. Centered card for empty/placeholder screens.

### `components/layout/` — app shell
- **nav-config.ts** — `NAV_ITEMS` array (`{label, href, icon}`): Dashboard, Trips, Vault, Profile. Exports `NavItem` type.
- **sidebar.tsx** *(client)* — desktop (`lg:`) vertical nav. Highlights active route via `usePathname`. 44px min-height items.
- **tab-bar.tsx** *(client)* — mobile (`lg:hidden`) fixed bottom tab bar with `env(safe-area-inset-bottom)` padding; 56px min-height targets; active-tab glow.
- **header.tsx** *(client)* — mobile sticky top bar: logo + Clerk `UserButton`; safe-area top inset.

### `components/documents/`
- **vault-client.tsx** *(client)* — main Vault orchestrator. Props: `initialDocuments: DocumentDTO[]`. Holds documents state, type filter (`ALL` + each `DocumentType`), upload panel toggle, detail drawer. **Polling:** every `POLL_INTERVAL_MS=5000`, up to `MAX_POLL_ATTEMPTS=10`, re-fetches `/api/documents` while any doc has `aiProcessed: false`; marks timed-out IDs after budget exhausted (`documentsRef` keeps the interval closure fresh).
- **upload-zone.tsx** *(client)* — drag-and-drop + file picker. Props: `onUploaded`, `onLimitReached`, `tripId?`. Pre-validates with `validateUpload`, requests presigned URL, PUTs to S3 via `XMLHttpRequest` with progress; supports per-item retry reusing the issued URL. Surfaces 402 limit via `onLimitReached`.
- **document-card.tsx** *(client)* — Props: `document`, `onClick`, `timedOut?`. Type icon, name, "Added" date, `ExpiryBadge`; shows processing/timed-out state.
- **document-detail-drawer.tsx** *(client)* — Props: `document|null`, `onClose`, `onDeleted`. Slide-over: metadata fields, download (fetches fresh presigned URL from `/api/documents/[id]`), two-step delete confirm.
- **document-type-icon.tsx** — `DocumentTypeIcon` (props: `type`, `className?`) maps each `DocumentType` to a lucide icon. Exports `DOCUMENT_TYPE_LABELS` record.
- **expiry-badge.tsx** — `ExpiryBadge` (props: `expiryDate`, `aiProcessed`). Pure `getExpiryStatus(expiryDate, aiProcessed, now?)` → `processing|none|valid|expiring|expired` (`EXPIRING_WINDOW_DAYS=30`); colour-coded badge.

### `components/trips/`
- **trips-client.tsx** *(client)* — Props: `initialTrips`. Header + "New trip" button, grid of `TripCard`s or `EmptyState`, hosts `CreateTripModal`.
- **trip-card.tsx** *(client)* — Props: `trip: TripDTO`. Link to `/trips/[id]`; name, destination (via `getCountryName`), trip-type label, departure date, doc count, `HealthScoreRing`.
- **trip-detail-client.tsx** *(client)* — Props: `trip: TripDetailDTO`. Tabbed (Checklist | Documents) workspace. Header with back link, share (calls `/share`), delete (calls DELETE → router push). Documents tab embeds `UploadZone`/`DocumentCard`/`DocumentDetailDrawer`; checklist tab embeds `ChecklistPanel`. Recomputes health score locally via `computeHealthScore`.
- **create-trip-modal.tsx** *(client)* — Props: `onClose`. Multi-step form (name, origin/destination via `CountrySelect`, dates, `tripType` with icons). POSTs `/api/trips`, toasts, routes to new trip.
- **country-select.tsx** *(client)* — Props: `value`, `onChange`, `placeholder?`, `id?`. Searchable dropdown over `COUNTRIES`; click-outside to close.
- **checklist-panel.tsx** *(client)* — Props: `tripId`, `items`, `onItemUpdated`. Renders items grouped by status config; PATCHes `/api/trips/[id]/checklist/[itemId]` to change status; regenerate button hits `/checklist/generate`.
- **health-score-ring.tsx** *(client)* — Props: `score: TripHealthScore`, `size?` (`sm`|`md`). SVG ring; colour by percent (≥80 green, ≥50 amber, else red, null grey); centre label `%` or `—`.

---

## 9. Pages

- **Root `layout.tsx`** — `ClerkProvider`, Inter font (`--font-inter`), dark `body`, Sonner `Toaster` (top-center, dark styling), PWA metadata (`manifest`, `appleWebApp`) and viewport (`viewportFit: cover`, themeColor `#3B7FEB`).
- **`(auth)/layout.tsx`** — shell: `Sidebar` (desktop) + content column with mobile `Header`, desktop `UserButton` bar, `main` padded clear of the tab bar, mobile `TabBar`.
- **`(auth)/loading.tsx`** / **`error.tsx`** — global Suspense fallback and error boundary (with `reset`).
- **`(auth)/dashboard/page.tsx`**, **`profile/page.tsx`** — placeholders (`EmptyState`).
- **`(auth)/trips/page.tsx`**, **`trips/[id]/page.tsx`**, **`vault/page.tsx`** — server components that fetch the matching `/api/...` endpoint (forwarding the request cookie, `cache: 'no-store'`) and render the corresponding client component. Trip detail `notFound()`s on 403/404. **This is the API-first compliance pattern — pages fetch their own API, they don't touch Prisma.**
- **`(public)/page.tsx`** — marketing landing (hero, feature cards, sign-in/up CTAs).
- **`(public)/shared/[token]/page.tsx`** — read-only shared checklist; fetches `/api/shared/[token]`, groups items by required level, shows progress bar + sign-up CTA. No auth.
- **`sign-in` / `sign-up`** — Clerk catch-all `<SignIn>` / `<SignUp>`.

---

## 10. Key Patterns

1. **API-first / no Prisma in pages.** Pages and client components only `fetch('/api/...')`. Prisma is imported solely under `src/app/api/` (and the workers, which are also server-side). Server-component pages forward the request `cookie` header so Clerk auth survives the internal fetch. This preserves the Expo-app contract.

2. **Two-step S3 upload.** The API never receives file bytes. Client requests a presigned PUT URL (`POST /api/documents/upload-url`), which also creates the DB row and enqueues AI processing; client then PUTs the file straight to S3. Server-side write order: presign → create row → enqueue.

3. **Presigned URLs only, 15-minute lifetime.** `PRESIGNED_EXPIRY_SECONDS = 900` in `s3.ts`. Uploads set `ServerSideEncryption: 'AES256'`. The DB stores only `fileKey` (e.g. `documents/{userId}/{timestamp}_{sanitised-filename}`); it's redacted from logs and excluded from DTOs. Download URLs are minted fresh on each detail request.

4. **Async AI processing.** Upload route returns 201 immediately after enqueuing; the worker does the Claude call and flips `aiProcessed`. A queue-add failure is logged but does not fail the upload.

5. **Polling for async results.** `VaultClient` polls `/api/documents` every 5s (max 10 attempts) while any doc is unprocessed, then gives up and marks those docs timed-out. Uses a `ref` mirror of state to avoid stale closures.

6. **Injectable deps for testability.** Worker core functions take a `deps` object (prisma/anthropic/S3/fetch) defaulting to real clients; tests inject mocks. Core logic files carry no BullMQ/Redis imports.

7. **DTO serialisation.** Prisma rows never cross the API boundary directly — `toDocumentDTO()` and the inline trip mappers strip sensitive fields (`fileKey`, `userId`) and ISO-serialise dates. Health scores and checklist counts are computed server-side.

8. **Consistent error shape.** Every handler returns `{ error: string, code?: string }` with correct status codes: 400 (bad JSON/validation), 401 (no session), 403 (not owner — trips), 404 (not found / not owner — documents), 422 (unprocessable upload), 402 (`LIMIT_TRIPS` / `LIMIT_DOCUMENTS`), 500 (caught exception). Stack traces never leak.

9. **Ownership guards.** Every per-resource handler loads the row, compares `userId`, and rejects before mutating. Checklist-item PATCH additionally verifies the item belongs to the trip and any linked document belongs to the user.

10. **Pure helpers, separately tested.** `validateUpload`, `computeHealthScore`, `getExpiryStatus`, `formatDate`/`formatFileSize`, and the Zod parsers are side-effect-free and unit-tested in isolation.

---

## 11. Theme & Styling (`tailwind.config.ts`, `globals.css`)

Custom dark-navy design system (no default Tailwind palette for these):
- **surface**: `base #080E1A`, `sunken #060C16`, `elevated #0F1B2D`, `overlay #162338`, `border #1E3352`, `hover #1A2D47`.
- **text**: `primary #F0F4FA`, `secondary #8FA3BF`, `muted #506280`, `placeholder #364D66`, `inverse #080E1A`.
- **accent** (blue): `DEFAULT #3B7FEB`, `hover #2E6DD6`, `active #2560BF`, `subtle #162338`, `muted #1E3352`.
- **success/warning/danger**: each has `DEFAULT/subtle/border/text` variants.
- **fontFamily.sans** → `var(--font-inter)`. Custom `fontSize` scale incl. `2xs` (0.625rem). Custom `borderRadius` and `boxShadow` (`card`, `modal`).
- `globals.css`: Tailwind layers, `color-scheme: dark`, focus-visible ring `#3B7FEB`, `.text-balance`, `.pb-safe`/`.pt-safe` safe-area utilities.

---

## 12. Environment Variables (`src/env.ts`)

Validated with Zod at import (`env = envSchema.parse(process.env)`) → **fails fast at boot** if any are missing/invalid.

| Var | Type | Used for |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | string | Clerk client |
| `CLERK_SECRET_KEY` | string | Clerk server |
| `CLERK_WEBHOOK_SECRET` | string | svix webhook verification |
| `DATABASE_URL` | url | Postgres (via `@prisma/adapter-pg`) |
| `REDIS_URL` | url | BullMQ / ioredis |
| `AWS_REGION` | string | S3 client |
| `AWS_ACCESS_KEY_ID` | string | S3 credentials |
| `AWS_SECRET_ACCESS_KEY` | string | S3 credentials |
| `S3_BUCKET_NAME` | string | document bucket |
| `ANTHROPIC_API_KEY` | string | Claude SDK |
| `RESEND_API_KEY` | string | email (Phase 6, not yet wired) |
| `NEXT_PUBLIC_APP_URL` | url | base URL for server-side internal fetches |

Secrets live in `.env.local`, loaded by Next automatically, and explicitly by `workers/load-env.ts` and `prisma.config.ts` for non-Next processes.

---

## 13. Known Decisions & Trade-offs

- **`next.config.mjs` → `next.config.js`.** The original ESM config was deleted and replaced with a CommonJS file because `next-pwa` is published as CommonJS (`require('next-pwa')`). Shows as a deletion in git status.
- **PWA manifest icons missing.** `public/manifest.json` references `/icons/icon-192.png` and `/icons/icon-512.png`, but no `public/icons/` directory exists yet. Add icons before shipping the PWA (Phase 8). `next-pwa` is disabled in development.
- **No migrations generated.** `prisma/migrations/` doesn't exist; schema applied via push/seed only. Run `prisma migrate dev --name init` before any deploy. Per CLAUDE.md, never hand-edit migration files.
- **Plan limits are hard-coded constants, Free tier only.** `FREE_TRIP_LIMIT = 3` (in `trips/route.ts`) and `FREE_DOCUMENT_LIMIT = 10` (in `lib/documents.ts`). Paid-tier logic and a `plan` field on `User` don't exist yet — every user is effectively Free.
- **`User.nationality` is never set by the app.** No Profile UI or API writes it (Profile page is a placeholder). The checklist generator defaults nationality to `'US'` when null, which weakens checklist accuracy until the Profile page (Phase 6.x) lands.
- **`ChecklistItem.documentId` is a soft link** — a plain `String?`, not a Prisma relation/FK. Integrity (document belongs to same user) is enforced in the PATCH handler, not the DB.
- **AI model `claude-opus-4-6`.** Hard-coded in both workers. Newer Opus (`claude-opus-4-8`) is available; bump deliberately and re-validate parser output.
- **Resend `from` address must be a verified sender domain.** `ALERT_FROM` is hard-coded as `alerts@vaulttrip.app` in `src/lib/resend.ts`. The domain must be verified in the Resend dashboard before emails will deliver.
- **Alert dedup is scheduler-side, not sender-side.** `runExpiryCheck` checks `AlertSentLog` before enqueuing; `sendAlert` writes the log after sending. A brief TOCTOU window exists if the scheduler runs twice within the same UTC day. Acceptable given a daily cron.
- **Geist fonts present but unused.** `src/app/fonts/GeistVF.woff` / `GeistMonoVF.woff` are left from the create-next-app template; the app loads Inter via `next/font/google`.
- **Server components fetch their own API over HTTP** (forwarding cookies) rather than calling a shared server function. This is a deliberate choice to keep a single data path that the future Expo app will also use — at the cost of an extra internal round-trip per page load.
- **`getCurrentUser()` returns `null` if the Clerk webhook hasn't created the User row yet**, which surfaces as a 401. There's a race window between Clerk sign-up and `user.created` webhook delivery.

---

*End of reference. Regenerate or amend this file whenever the schema, API surface, worker behaviour, or core patterns change.*
