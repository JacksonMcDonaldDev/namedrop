# System Architecture: Namedrop

**Version:** 2.0
**Date:** 2026-03-08 (rewritten 2026-08-06 for the learning-first deck pivot — see §12)

---

## 1. Scope Summary

Namedrop is a single-user, self-hosted web app. No authentication, no multi-user. Home is a **deck browser**: a virtual **My People** deck (backed by contacts, SM-2 study) and one or more **prebuilt** decks (curated rosters, shuffled drill sessions). The old contacts-first Dashboard is retired.

**Deferred:**
- User accounts and authentication (JWT)
- **Smart decks** — saved-filter decks over contacts (reserved in the `decks.type` enum, not implemented)
- Additional prebuilt decks beyond Celebrities
- Multiple card types
- Applying SM-2 scheduling to prebuilt decks

---

## 2. Core User Loop

```
                          ┌────────────────┐
                          │  Deck Browser   │
                          │       (/)       │
                          └───────┬────────┘
                                  │
                clicking a deck card opens its detail page
                                  │
                                  ▼
                          ┌────────────────┐
                          │  Deck Detail    │
                          │ /decks/:id      │
                          │                 │
                          │ People grid     │
                          │ Technique tips  │
                          └───┬────────┬───┘
                              │        │
                My People     │        │  Prebuilt (Celebrities)
                              ▼        ▼
        ┌──────────────────────┐    ┌───────────────────────┐
        │ Add/Edit Contact      │    │ Drill Session          │
        │ /decks/my-people/...  │    │ /decks/:id/drill       │
        │                       │    │                        │
        │ LinkedIn import       │    │ Face → reveal → got-it/│
        │ Photo upload          │    │ missed-it, full deck   │
        └───────────────────────┘    │ shuffled               │
                              │       └───────────┬────────────┘
        ┌──────────────────────┐                  │
        │ Study Session         │                  ▼
        │ /study                │       ┌────────────────────┐
        │                       │       │ Drill Summary       │
        │ Due queue, SM-2       │       │ Got-it/missed-it,   │
        │ Again/Hard/Good/Easy  │       │ accuracy, per-person│
        └──────────┬────────────┘       └──────────┬─────────┘
                   ▼                                │
        ┌──────────────────────┐                    │
        │ Study Summary         │                    │
        └──────────┬────────────┘                    │
                   └──────────────┬──────────────────┘
                                  ▼
                          back to Deck Browser
```

### Flow: "I have a few seconds, let me practice"
1. Deck Browser → click the Celebrities card → Deck Detail
2. Technique tips modal auto-opens on first visit (or reopen via button)
3. Click "Start Session" → Drill: shuffled faces, reveal, got it / missed it
4. Summary screen → back to Deck Browser

### Flow: "I just met someone"
1. Deck Browser → click the My People card → Deck Detail
2. Click "Add Person" → Contact Form: fill in first name (only required field), optionally photo/LinkedIn import/mnemonic
3. Save → back to My People deck detail

### Flow: "Time to study my real contacts"
1. Deck Browser → My People card's "Study Now" (or Deck Detail's "Start Studying")
2. App gathers all contacts with photos that are due or never reviewed
3. If nothing is due, the session falls back to all studyable cards (practice mode)
4. Card appears: photo on front → reveal (name, where met, mnemonic) → rate Again/Hard/Good/Easy
5. SM-2 updates scheduling state → next card or summary

---

## 3. Pages & Navigation

| Page | Route | Purpose |
|---|---|---|
| Deck Browser | `/` | Entry point. Grid of deck cards — My People (person count, due count) + prebuilt decks (person count, last practiced, accuracy). |
| Deck Detail | `/decks/:id` | People grid, technique tips modal, start-session action. `:id` is the literal `my-people` for the virtual deck, or a `decks.id` UUID for a prebuilt deck. For My People: "Add Person" button and clickable faces (→ edit). |
| Add Person | `/decks/my-people/new` | Contact form: first name, last name, mnemonic, where met + photo upload + LinkedIn URL import. |
| Edit Person | `/decks/my-people/:personId` | Same form, pre-populated. Delete option. |
| Drill Session | `/decks/:id/drill` | Prebuilt-deck only. Full-screen shuffled got-it/missed-it drill; summary renders in place when the deck is exhausted. |
| Study Session | `/study` | My People only. Active SM-2 session — card display + rating. Summary renders in place on completion. |

Navigation: top bar with "namedrop" (home) and a single "Decks" button; hidden during both drill and study sessions (`/study` and `/decks/:id/drill`) for a distraction-free view. The standalone Contacts list/routes from before the pivot are retired — My People's people grid is the only browsing surface for contacts now.

---

## 4. API Endpoint Inventory

Base path: `/api`

### Decks

| Method | Path | Purpose |
|---|---|---|
| GET | `/decks` | List all decks: the virtual My People deck first (`person_count`, `due_count`), then prebuilt decks (`person_count`, `last_practiced`, `accuracy`). |
| GET | `/decks/my-people` | My People detail — summary + `people` array sourced from `contacts`. |
| GET | `/decks/:id` | Prebuilt deck detail — summary + `people` array (each with attribution fields). 404 if unknown, 400 if `:id` isn't a UUID. Registered after the literal `/decks/my-people` route so it never intercepts it. |

### Practice Sessions (drill lifecycle, prebuilt decks only)

Mounted at `/decks/:deckId/practice-sessions`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/decks/:deckId/practice-sessions` | Start a drill session. 400 if the deck isn't `prebuilt` or doesn't exist. |
| POST | `/decks/:deckId/practice-sessions/:sessionId/events` | Submit one `{ deck_person_id, result }` event (`result` is `got_it` or `missed_it`). 400 if the person isn't in the deck or the session is already complete. |
| POST | `/decks/:deckId/practice-sessions/:sessionId/complete` | Mark the session complete, return its summary (`total`, `got_it`, `missed_it`, `accuracy`). |

No session queue is held in memory — the client fetches/shuffles the deck's roster itself and drives through it by `deck_person_id`, so there's no server-side state to lose on a restart (see §7b).

### Contacts

| Method | Path | Purpose |
|---|---|---|
| GET | `/contacts` | List non-placeholder contacts. Supports `?search=` (first name, last name, company, where_met). Backs the My People people grid. |
| GET | `/contacts/:id` | Get single contact with mutual relationships resolved |
| POST | `/contacts` | Create contact. Multipart form: JSON fields + photo file. |
| PUT | `/contacts/:id` | Update contact. Multipart form: JSON fields + optional new photo. |
| DELETE | `/contacts/:id` | Delete contact. Triggers placeholder garbage collection. |

### Photos

| Method | Path | Purpose |
|---|---|---|
| GET | `/uploads/photos/:filename` | Static file serving for contact (My People) photos |
| GET | `/uploads/celebrity-photos/:filename` | Static file serving for prebuilt-deck (Celebrities) photos — separate directory from contact uploads |

### Mutual Relationships

| Method | Path | Purpose |
|---|---|---|
| GET | `/contacts/:id/mutuals` | Get mutual relationships for a contact |
| PUT | `/contacts/:id/mutuals` | Replace mutual relationships (array of contact IDs and/or new placeholder names) |

Implemented (including placeholder auto-creation and orphan GC) but still has **no client UI** — unchanged from before the pivot, see §12.

### LinkedIn Import

| Method | Path | Purpose |
|---|---|---|
| POST | `/linkedin/scrape` | Body: `{ url }`. Scrapes a public LinkedIn profile server-side and returns `first_name`, `last_name`, and the profile photo as base64. Used by the Add/Edit Person form. |

### Study (SM-2, My People only)

| Method | Path | Purpose |
|---|---|---|
| POST | `/study/sessions` | Start a new study session. Returns session ID + first card. |
| GET | `/study/sessions/:id/next` | Get next due card in session |
| POST | `/study/sessions/:id/review` | Submit a rating for a card. Body: `{ contact_id, rating }`. Returns next card or completion signal. |
| POST | `/study/sessions/:id/complete` | Mark session complete. Returns summary stats. |
| GET | `/study/status` | Due-card count + next due date. Backs the My People deck card's due-count badge. |

---

## 5. Frontend Stack

**UI Framework:** [Mantine v8](https://mantine.dev/) — a full-featured React component library with built-in hooks, form handling, and CSS Modules support.

**Why Mantine:**
- Native CSS Modules support (no Tailwind or CSS-in-JS runtime)
- Rich component set that maps directly to Namedrop's needs: forms, image upload, cards, rating inputs, modals, notifications
- Built-in hooks (`useForm`, `useDisclosure`, `useDebouncedValue`) reduce boilerplate
- Consistent design tokens (spacing, colors, typography) out of the box

**Key Mantine components in use:**
- `AppShell` — top navigation, hidden during drill/study sessions
- `Card`, `SimpleGrid`, `Avatar`/`Image`, `Badge` — deck browser cards and people grids
- `Modal`, `List` — technique tips
- `TextInput`, `Textarea` — contact form fields
- `Dropzone` / `FileInput` — photo upload
- `Skeleton` — loading states across deck browser, deck detail, drill, study

---

## 6. Project Structure

```
namedrop/
├── client/                    # React 19 (Vite) frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DeckBrowser.tsx    # / — grid of deck cards
│   │   │   ├── DeckDetail.tsx     # /decks/:id — people grid + technique tips
│   │   │   ├── Drill.tsx          # /decks/:id/drill — prebuilt drill session
│   │   │   ├── Study.tsx          # /study — My People SM-2 session
│   │   │   └── ContactForm.tsx    # /decks/my-people/new, /decks/my-people/:personId
│   │   ├── api/
│   │   │   ├── decks.ts           # GET /decks, /decks/:id
│   │   │   ├── practiceSessions.ts# drill lifecycle client
│   │   │   ├── contacts.ts
│   │   │   ├── study.ts
│   │   │   └── fetch.ts
│   │   ├── theme.ts
│   │   ├── ErrorBoundary.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── postcss.config.cjs
│   ├── vite.config.ts
│   └── package.json
│
├── server/                    # Node.js + Express backend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── decks.ts             # /api/decks, /api/decks/my-people, /api/decks/:id
│   │   │   ├── practiceSessions.ts  # mounted under decks.ts, drill lifecycle
│   │   │   ├── contacts.ts
│   │   │   ├── study.ts
│   │   │   ├── linkedin.ts
│   │   │   └── index.ts
│   │   ├── models/
│   │   │   ├── decks.ts             # deck summaries/detail, virtual My People assembly
│   │   │   ├── practiceSessions.ts  # drill session/event CRUD, getDeckProgress
│   │   │   ├── contacts.ts
│   │   │   ├── study.ts
│   │   │   └── mutualRelationships.ts
│   │   ├── services/
│   │   │   ├── sm2.ts               # SM-2 scheduling (My People only)
│   │   │   ├── photoService.ts      # sharp processing, shared by contacts + seed script
│   │   │   ├── placeholderGC.ts
│   │   │   └── linkedinService.ts
│   │   ├── middleware/        # validation, error handling, request logging
│   │   ├── migrations/        # SQL migration files (001_initial, 002_decks, 003_practice_sessions)
│   │   ├── db.ts
│   │   ├── app.ts             # Express app (no side effects — imported directly by tests)
│   │   ├── server.ts          # waitForDb / runMigrations / listen
│   │   └── migrate.ts
│   ├── scripts/
│   │   ├── seedCelebrities.ts       # one-off Celebrities roster insert
│   │   └── celebrities-roster.json
│   ├── tests/                 # Jest + Supertest, real Postgres test DB
│   ├── uploads/
│   │   ├── photos/                  # My People contact photos
│   │   └── celebrity-photos/        # prebuilt-deck photos, separate directory
│   └── package.json
│
├── docker-compose.yml
├── PRD.md
├── DATA_MODEL.md
├── SYSTEM_ARCHITECTURE.md
└── README.md
```

---

## 7. Study Session Rules — My People (SM-2)

### Card Pool
- All non-placeholder contacts with `photo_path IS NOT NULL`
- A card is **due** if `card_reviews.due_at <= now()` or if no `card_reviews` row exists (never reviewed)
- If nothing is due when a session starts, the session includes **all** studyable cards instead (practice mode)

### Session Behavior
- **Session size:** All due cards + up to **10 new cards** (never reviewed) per session, oldest-created first.
- **Card order:** Due (overdue) cards first, sorted by most overdue, then new cards.
- **"Again" re-queue:** re-queued to appear again later in the same session (after at least 3 other cards, or at the end if fewer than 3 remain).
- **Mid-session quit:** cards already rated are saved; the session stays incomplete (`completed_at` null).
- **Completion:** ends when all cards (including re-queued) have been reviewed.
- **Session queue storage:** the per-session card queue lives in server memory (a `Map` in `routes/study.ts`), not the database. A restart drops in-progress sessions; ratings already submitted are preserved. Known limitation, carried forward from before the pivot — not addressed here.

### SM-2 Implementation

```
function sm2(card, rating):
    // rating: again=0, hard=3, good=4, easy=5

    if rating < 3:  // Again
        card.repetitions = 0
        card.interval_days = 1
    else:
        if card.repetitions == 0:
            card.interval_days = 1
        else if card.repetitions == 1:
            card.interval_days = 6
        else:
            card.interval_days = round(card.interval_days * card.ease_factor)

        card.repetitions += 1

    // Update ease factor (minimum 1.3)
    card.ease_factor = max(1.3,
        card.ease_factor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
    )

    card.due_at = now() + card.interval_days days
    card.last_reviewed_at = now()
```

---

## 7b. Drill Session Rules — Prebuilt Decks

Deliberately much simpler than SM-2 study — no scheduling, no due dates, no ratings scale.

- **Deck pool:** the entire `deck_people` roster for the deck. No due/eligibility filtering — every person is drilled every session.
- **Shuffle:** performed client-side (`Drill.tsx`) on session start; the server has no concept of card order.
- **Session flow:** client calls `POST /practice-sessions` to open a session, then for each person in its shuffled order: shows the face, reveals name + mnemonic on request, and submits exactly one `POST .../events` (`got_it` or `missed_it`) per person. On the last person, calls `POST .../complete`.
- **No server-side queue:** unlike My People's in-memory `Map`, the drill has nothing to lose on a server restart — the client always knows where it is in its own shuffled list, and every event is a self-contained, already-persisted write.
- **Progress:** `last_practiced`/`accuracy` shown on the deck browser and deck detail come from the most recently *completed* session's events (`models/practiceSessions.ts#getDeckProgress`), recomputed on every read — nothing is stored as a running aggregate.
- **Isolation:** enforced structurally, not just behaviorally — `practice_sessions`/`practice_events` reference `decks`/`deck_people` only, never `contacts` or `card_reviews`. A drilled celebrity can never affect a My People due date, and vice versa.

---

## 8. Photo Handling

### Upload (My People contacts)
- Accepted formats: JPEG, PNG, WebP
- Max upload size: 10 MB (enforced by middleware)
- Server-side processing on upload (sharp):
  - Auto-rotate based on EXIF orientation, then strip EXIF metadata (privacy)
  - Resize to max 800×800px (maintain aspect ratio, no enlargement)
  - Convert to JPEG (quality 85)
  - Save to `server/uploads/photos/{contact_id}.jpg`

### Prebuilt-deck seed photos (Celebrities)
- Fetched from Wikimedia Commons by `server/scripts/seedCelebrities.ts`, a manual one-off (not run on boot, not part of `npm` scripts)
- Processed through the **same** sharp pipeline as contact photos (resize 800×800, auto-rotate + strip EXIF, JPEG quality 85)
- Saved to `server/uploads/celebrity-photos/`, kept separate from user uploads
- Attribution (author, source URL, license) recorded per person in `deck_people`

### Serving
- Express serves `uploads/photos/` and `uploads/celebrity-photos/` as separate static directories
- In Docker, `uploads/` is a named volume for persistence

### Deletion
- When a contact is deleted, its photo file is deleted from disk (prebuilt-deck photos have no delete path — decks aren't edited through the UI)

---

## 9. Data Model (Active Tables)

Single-user, no auth — the active tables are:

| Table | Status |
|---|---|
| `contacts` | Active |
| `mutual_relationships` | Active |
| `card_reviews` | Active |
| `review_events` | Active |
| `study_sessions` | Active |
| `decks` | Active — `type = 'prebuilt'` only; `type = 'smart'` is a reserved, unimplemented value |
| `deck_people` | Active |
| `practice_sessions` | Active |
| `practice_events` | Active |
| `users` | **Not implemented** — reserved for a future auth pass, see DATA_MODEL.md |

Full column-level detail for every table lives in **DATA_MODEL.md**; migrations are `server/migrations/001_initial.sql` (contacts/study), `002_decks.sql` (decks/deck_people), and `003_practice_sessions.sql` (practice_sessions/practice_events).

---

## 10. Docker Compose

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: namedrop
      POSTGRES_USER: namedrop
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  server:
    build: ./server
    environment:
      DATABASE_URL: postgres://namedrop:${DB_PASSWORD}@db:5432/namedrop
    volumes:
      - ./server/src:/app/src
      - photos:/app/uploads/photos
    ports:
      - "3001:3001"
    depends_on:
      - db

volumes:
  pg_data:
  photos:
```

The client service is commented out in `docker-compose.yml` — the client runs locally via `npm run dev` per `CLAUDE.md`, proxying `/api` and `/uploads` to the server container. `uploads/celebrity-photos/` is not currently volume-mounted separately; it's written directly into the server's working tree by the seed script.

---

## 11. Roadmap Hooks

Decisions made now to keep future migrations clean:

| Future feature | Preparation already in place |
|---|---|
| Auth | Add `users` table, add `user_id` FK to all tables, add auth middleware. Additive migration, no schema changes needed to existing tables. |
| Smart decks (saved-filter decks) | `decks.type` already has `smart` as a valid enum value; would need a `filter` JSONB column and filter-execution logic (OR within array fields, AND across fields, ILIKE for text, range for dates) — no implementation yet. |
| Multiple card types | Add `card_type` column to `card_reviews` and `review_events`, update unique constraints. |
| SM-2 for prebuilt decks | Not planned; would mean merging the drill and study mechanics, explicitly out of scope for this pivot. |
| Additional prebuilt decks | The deck/drill model already generalizes — a new deck is a new `decks` row + `deck_people` rows + a seed script; no schema change needed. |

---

## 12. Implementation Status (2026-08-06)

Where the implementation stands relative to this document:

- **Pivot is built and merged:** deck browser home, deck detail (both types) with technique tips, prebuilt Celebrities deck with full drill lifecycle and DB-backed session state, My People unification (contact management moved inside the deck, standalone Contacts nav/routes retired), SM-2 study unchanged. The schema in §9 matches the three migrations exactly.
- **Automated tests exist:** Jest + Supertest driving the Express app over HTTP against a real Postgres test database (`server/tests/`), covering decks, practice-session lifecycle, contacts, and study. This is a change from the pre-pivot state, which had no test suite at all.
- **Mutual relationships: still backend only.** Endpoints, placeholder auto-creation, and orphan GC (`services/placeholderGC.ts`) are implemented and `client/src/api/contacts.ts` has bindings, but no page renders or edits mutuals. Unchanged by the pivot.
- **Contact form is still trimmed:** only first name, last name, where met, and mnemonic have inputs. Email, phone, company, relationship, and notes remain in the schema/API/study-card payload but have no UI. Unchanged by the pivot.
- **LinkedIn import** (`routes/linkedin.ts`, `services/linkedinService.ts`) continues to work unchanged, now reachable from the Add/Edit Person routes under `/decks/my-people/*`.
- **Not built:** smart decks, additional prebuilt decks, auth.
