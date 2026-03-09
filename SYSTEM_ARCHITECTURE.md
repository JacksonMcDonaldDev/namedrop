# System Architecture: Namedrop (V1)

**Version:** 1.0
**Date:** 2026-03-08

---

## 1. V1 Scope Summary

V1 is a single-user, self-hosted web app. No authentication, no decks, no filters. One user adds contacts and studies all of them in a single global pool.

**Deferred to V2:**
- User accounts and authentication (JWT)
- Named decks with saved filters
- Filter execution (OR within fields, AND across fields, ILIKE for text, range for dates)
- Multiple card types

---

## 2. Core User Loop

```
┌─────────────┐
│  Dashboard   │
│              │
│  [Study]     │──────────────────────────┐
│  [Contacts]  │───────┐                  │
└─────────────┘       │                  │
                       ▼                  ▼
              ┌──────────────┐    ┌──────────────┐
              │ Contact List  │    │ Study Session │
              │              │    │              │
              │ Search/filter │    │ Photo (front) │
              │ + Add button  │    │ Details (back)│
              └──────┬───────┘    │ Rate card     │
                     │            │ Next card     │
                     ▼            └──────┬───────┘
              ┌──────────────┐           │
              │ Add/Edit      │           ▼
              │ Contact       │    ┌──────────────┐
              │              │    │ Session       │
              │ Inline photo  │    │ Summary       │
              │ upload        │    │              │
              └──────────────┘    │ Cards reviewed│
                                  │ Accuracy      │
                                  └──────────────┘
```

### Flow: "I just met someone"
1. Dashboard → Contacts
2. Click "Add Contact"
3. Fill in first name (only required field), optionally snap/upload photo and add details
4. Save → back to contact list

### Flow: "Time to study"
1. Dashboard → Study
2. App gathers all contacts with photos that are due or never reviewed
3. If no cards are due: "Nothing to study right now" with next due date
4. Card appears: photo on front
5. User mentally recalls, taps to reveal back (all contact details)
6. User rates: Again / Hard / Good / Easy
7. SM-2 updates scheduling state
8. Next card (or summary if done)
9. Session summary: total reviewed, breakdown by rating

---

## 3. Pages & Navigation

| Page | Route | Purpose |
|---|---|---|
| Dashboard | `/` | Entry point. Study and Contacts buttons. Shows due card count. |
| Contact List | `/contacts` | Searchable list of all non-placeholder contacts. Add button. |
| Add Contact | `/contacts/new` | Form with all contact fields + photo upload |
| Edit Contact | `/contacts/:id` | Same form, pre-populated. Delete option. |
| Study Session | `/study` | Active study session — card display + rating |
| Session Summary | `/study/summary` | Post-session stats |

Navigation: simple top bar with "namedrop" (home) and "Contacts" link. Study is accessed from dashboard.

---

## 4. API Endpoint Inventory

Base path: `/api`

### Contacts

| Method | Path | Purpose |
|---|---|---|
| GET | `/contacts` | List non-placeholder contacts. Supports `?search=` query param (searches first name, last name, company, where_met). |
| GET | `/contacts/:id` | Get single contact with mutual relationships resolved |
| POST | `/contacts` | Create contact. Multipart form: JSON fields + photo file. |
| PUT | `/contacts/:id` | Update contact. Multipart form: JSON fields + optional new photo. |
| DELETE | `/contacts/:id` | Delete contact. Triggers placeholder garbage collection. |

### Photos

Photos are uploaded as part of contact create/update (multipart). Served as static files.

| Method | Path | Purpose |
|---|---|---|
| GET | `/uploads/photos/:filename` | Static file serving for contact photos |

### Mutual Relationships

| Method | Path | Purpose |
|---|---|---|
| GET | `/contacts/:id/mutuals` | Get mutual relationships for a contact |
| PUT | `/contacts/:id/mutuals` | Replace mutual relationships (array of contact IDs and/or new placeholder names) |

### Study

| Method | Path | Purpose |
|---|---|---|
| POST | `/study/sessions` | Start a new study session. Returns session ID + first card. |
| GET | `/study/sessions/:id/next` | Get next due card in session |
| POST | `/study/sessions/:id/review` | Submit a rating for a card. Body: `{ contact_id, rating }`. Returns next card or completion signal. |
| POST | `/study/sessions/:id/complete` | Mark session complete. Returns summary stats. |
| GET | `/study/status` | Dashboard info: number of cards due now, next due date |

---

## 5. Frontend Stack

**UI Framework:** [Mantine v7](https://mantine.dev/) — a full-featured React component library with built-in hooks, form handling, and CSS Modules support.

**Why Mantine:**
- Native CSS Modules support (no Tailwind or CSS-in-JS runtime)
- Rich component set that maps directly to Namedrop's needs: forms, image upload, cards, rating inputs, modals, notifications
- Built-in hooks (`useForm`, `useDisclosure`, `useDebouncedValue`) reduce boilerplate
- Consistent design tokens (spacing, colors, typography) out of the box
- Active maintenance and large community

**Key Mantine components anticipated for V1:**
- `AppShell` — Dashboard layout with top navigation
- `TextInput`, `Textarea`, `Select` — Contact form fields
- `Dropzone` / `FileInput` — Photo upload
- `Card`, `Image`, `Badge` — Contact list items and flashcards
- `Rating` or `SegmentedControl` — Study session rating (Again/Hard/Good/Easy)
- `Progress`, `Stats` — Session summary
- `Modal` — Delete confirmation
- `Notification` — Success/error feedback

**Styling approach:** Mantine components + CSS Modules (`.module.css`) for custom styling. Mantine's theme is configured in `theme.ts` for consistent design tokens across the app.

---

## 6. Project Structure

```
namedrop/
├── client/                    # React (Vite) frontend
│   ├── src/
│   │   ├── pages/             # Page components (Dashboard, ContactList, etc.)
│   │   ├── components/        # Shared UI components
│   │   ├── api/               # API client functions
│   │   ├── theme.ts           # Mantine theme configuration
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── postcss.config.cjs     # Mantine PostCSS preset
│   ├── vite.config.ts
│   └── package.json
│
├── server/                    # Node.js + Express backend
│   ├── src/
│   │   ├── routes/            # Express route handlers
│   │   │   ├── contacts.ts
│   │   │   ├── study.ts
│   │   │   └── index.ts
│   │   ├── models/            # Database query functions
│   │   ├── services/          # Business logic (SM-2, photo processing, placeholder GC)
│   │   ├── middleware/        # Error handling, validation
│   │   ├── db.ts              # PostgreSQL connection (pg pool)
│   │   └── app.ts             # Express app setup
│   ├── migrations/            # SQL migration files
│   ├── uploads/               # Photo storage (volume-mounted in Docker)
│   │   └── photos/
│   └── package.json
│
├── docker-compose.yml
├── PRD.md
├── DATA_MODEL.md
├── SYSTEM_ARCHITECTURE.md
└── README.md
```

---

## 7. Study Session Rules (V1)

### Card Pool
- All contacts belonging to the user where `is_placeholder = false` AND `photo_path IS NOT NULL`
- A card is **due** if `card_reviews.due_at <= now()` or if no `card_reviews` row exists (never reviewed)

### Session Behavior
- **Session size:** All due cards + up to **10 new cards** (never reviewed) per session. New cards are introduced in the order they were created (oldest first).
- **Card order:** Due (overdue) cards first sorted by most overdue, then new cards.
- **"Again" re-queue:** If rated "Again", the card is re-queued and will appear again later in the same session (after at least 3 other cards, or at the end if fewer than 3 remain).
- **Mid-session quit:** The session can be abandoned. Cards already rated are saved. Unreviewed cards remain in their current scheduling state. The session is marked incomplete (`completed_at` stays null).
- **Completion:** Session ends when all cards (including re-queued) have been reviewed. Summary is displayed.

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

## 8. Photo Handling

### Upload
- Accepted formats: JPEG, PNG, WebP
- Max upload size: 10 MB (enforced by middleware)
- Server-side processing on upload:
  - Convert to JPEG
  - Resize to max 800x800px (maintain aspect ratio)
  - Strip EXIF metadata (privacy)
  - Save to `server/uploads/photos/{contact_id}.jpg`

### Serving
- Express serves `uploads/photos/` as a static directory
- In Docker, `uploads/` is a named volume for persistence

### Deletion
- When a contact is deleted, its photo file is deleted from disk

---

## 9. V1 Data Model (Simplified)

With no auth and no decks, the active V1 tables are:

| Table | V1 Status |
|---|---|
| `users` | **Skip** — single user, no auth. `user_id` columns omitted from V1 schema. |
| `contacts` | **Active** — no `user_id` column in V1 |
| `mutual_relationships` | **Active** |
| `decks` | **Skip** — no decks in V1 |
| `card_reviews` | **Active** — no `user_id` column in V1. No `card_type` column (always `name_recall`). |
| `review_events` | **Active** — no `user_id` column in V1 |
| `study_sessions` | **Active** — no `user_id` or `deck_id` column in V1 |

### V1 Schema

```sql
-- contacts
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_placeholder BOOLEAN NOT NULL DEFAULT false,
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    relationship TEXT,
    where_met TEXT,
    photo_path TEXT,
    mnemonic TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_placeholder ON contacts (is_placeholder);

-- mutual_relationships
CREATE TABLE mutual_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    mutual_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT no_self_reference CHECK (contact_id != mutual_contact_id),
    UNIQUE (contact_id, mutual_contact_id)
);

-- card_reviews (SM-2 state)
CREATE TABLE card_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    ease_factor FLOAT NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    repetitions INTEGER NOT NULL DEFAULT 0,
    due_at TIMESTAMPTZ,
    last_reviewed_at TIMESTAMPTZ,
    UNIQUE (contact_id)
);

-- study_sessions
CREATE TABLE study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- review_events
CREATE TABLE review_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    rating TEXT NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 10. Docker Compose (V1)

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
      - photos:/app/uploads/photos
    ports:
      - "3001:3001"
    depends_on:
      - db

  client:
    build: ./client
    ports:
      - "3000:3000"
    depends_on:
      - server

volumes:
  pg_data:
  photos:
```

---

## 11. V2 Roadmap Hooks

Decisions made now to keep V2 migration clean:

| V2 Feature | V1 Preparation |
|---|---|
| Auth | Add `users` table, add `user_id` FK to all tables, add auth middleware. No V1 schema changes needed — additive migration. |
| Decks + Filters | Add `decks` table, add `deck_id` to `study_sessions`. Filter semantics: OR within array fields, AND across fields, ILIKE for text, range for dates. |
| Multiple card types | Add `card_type` column to `card_reviews` and `review_events`, update unique constraint. |
