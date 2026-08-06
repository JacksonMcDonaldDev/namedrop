# Data Model: Namedrop

> **Scope note (2026-08-06):** This document describes the implemented schema plus the reserved-but-unimplemented pieces called out explicitly below (`users`, `decks.type = 'smart'`). The active tables match `server/migrations/001_initial.sql`, `002_decks.sql`, and `003_practice_sessions.sql` exactly — no `users` table, no `user_id` columns anywhere, no `card_type` column. Namedrop remains single-user; auth is out of scope for the current pivot.

---

## Entity Overview

| Table | Purpose |
|---|---|
| `contacts` | All contacts — full and placeholder. Also the source data for the virtual My People deck. |
| `mutual_relationships` | Junction table linking contacts to their mutual connections |
| `decks` | Prebuilt decks (`type = 'prebuilt'`). `type = 'smart'` (saved-filter deck) is reserved in the schema, not implemented. |
| `deck_people` | Roster for a prebuilt deck — one row per person, with photo/mnemonic/attribution |
| `card_reviews` | SM-2 state per contact (My People study) |
| `review_events` | Immutable log of every My People study rating |
| `study_sessions` | A single SM-2 study session (My People) |
| `practice_sessions` | A single drill session against a prebuilt deck |
| `practice_events` | Immutable got-it/missed-it log per drill session |
| *(not a table)* | **My People** — a virtual deck, synthesized at the API layer from `contacts`. See below. |
| `users` | *Reserved, not implemented.* Authenticated user accounts — would gate all tables above via `user_id` in a future multi-user version. |

The deck model deliberately supersedes the old "decks store a saved filter" sketch from earlier data-model drafts: `decks` now holds explicit prebuilt rosters, and the reserved `smart` type is where a future saved-filter deck would live, rather than the two ideas coexisting.

---

## The Virtual "My People" Deck

My People has no row in `decks`. It's assembled at the API layer (`server/src/models/decks.ts#getMyPeopleDeck` / `getMyPeopleDeckDetail`) directly from `contacts`:

- `person_count` — count of non-placeholder contacts
- `due_count` — reuses the existing SM-2 due-card query (`models/study.ts#getStudyStatus`), so due-count math lives in one place
- Its "people" list for the detail page is just non-placeholder contacts (id, name, photo, mnemonic)

This keeps My People and the prebuilt deck model sharing one API shape (deck summary / deck detail) without migrating any contact data into `decks`/`deck_people`, and without a `decks` row that would need to stay in sync with `contacts`.

---

## Tables

### `contacts`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `is_placeholder` | BOOLEAN NOT NULL DEFAULT false | Placeholder = name only, not in My People or study sessions |
| `first_name` | TEXT NOT NULL | Only required field |
| `last_name` | TEXT | |
| `email` | TEXT | In schema/API only — no form UI (see PRD §11) |
| `phone` | TEXT | In schema/API only — no form UI |
| `company` | TEXT | In schema/API only — no form UI |
| `relationship` | TEXT | In schema/API only — no form UI |
| `where_met` | TEXT | |
| `photo_path` | TEXT | Server-relative path to uploaded image. Required for study session eligibility. |
| `mnemonic` | TEXT | Memory hook for their name |
| `notes` | TEXT | In schema/API only — no form UI |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Notes:**
- Placeholders have `is_placeholder = true` and only `first_name`, `last_name` are meaningful
- Full contacts (`is_placeholder = false`) are what My People and SM-2 study operate on
- Index on `is_placeholder`

---

### `mutual_relationships`

Junction table. Each row means: "contact A considers contact B a mutual connection." Unchanged from before the pivot; still backend-only, no UI.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `contact_id` | UUID FK → contacts | The contact this relationship belongs to |
| `mutual_contact_id` | UUID FK → contacts | The mutual connection (full contact or placeholder) |
| `created_at` | TIMESTAMPTZ | |

**Constraints:**
- `contact_id != mutual_contact_id` (no self-references)
- UNIQUE on `(contact_id, mutual_contact_id)`

**Cascade behavior:**
- If a full contact is deleted, its row as `contact_id` is deleted (and orphaned placeholders in `mutual_contact_id` are garbage collected)
- If a placeholder reaches zero rows referencing it as `mutual_contact_id`, it is deleted

---

### `decks`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `type` | TEXT NOT NULL CHECK IN (`prebuilt`, `smart`) | Only `prebuilt` rows exist today. `smart` (saved-filter deck) is reserved, unimplemented. |
| `name` | TEXT NOT NULL | e.g. "Celebrities" |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

My People is **not** a row here — see "The Virtual My People Deck" above.

---

### `deck_people`

The roster for a prebuilt deck. One row per person.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `deck_id` | UUID FK → decks, ON DELETE CASCADE | |
| `first_name` | TEXT NOT NULL | |
| `last_name` | TEXT | |
| `photo_path` | TEXT | Server-relative path, separate directory from contact photos (`uploads/celebrity-photos/`) |
| `mnemonic` | TEXT | Nullable; shown on drill reveal when present — a coaching hook for future coached-practice content |
| `attribution_author` | TEXT | Wikimedia Commons attribution |
| `attribution_source_url` | TEXT | |
| `attribution_license` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Constraints:**
- Index on `deck_id`

`deck_people` is structurally isolated from `contacts` — no shared table, no foreign key between them — so prebuilt-deck people can never leak into the contact list or the SM-2 due queue.

---

### `card_reviews`

Stores the current SM-2 scheduling state for each contact. A row is created on first review and updated on every subsequent review. Unchanged by the pivot.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `contact_id` | UUID FK → contacts | |
| `ease_factor` | FLOAT NOT NULL DEFAULT 2.5 | SM-2 ease factor |
| `interval_days` | INTEGER NOT NULL DEFAULT 0 | Days until next review |
| `repetitions` | INTEGER NOT NULL DEFAULT 0 | Consecutive successful reviews |
| `due_at` | TIMESTAMPTZ | When this card is next due |
| `last_reviewed_at` | TIMESTAMPTZ | |

**Constraints:**
- UNIQUE on `contact_id`

---

### `review_events`

Immutable log. One row per card rating during a My People study session. Unchanged by the pivot.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `session_id` | UUID FK → study_sessions | |
| `contact_id` | UUID FK → contacts | |
| `rating` | TEXT NOT NULL | `again`, `hard`, `good`, `easy` |
| `reviewed_at` | TIMESTAMPTZ | |

---

### `study_sessions`

A single SM-2 study session against My People. Unchanged by the pivot.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `started_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ | Null if in progress |

---

### `practice_sessions`

A single drill session against a prebuilt deck. Structurally separate from `study_sessions` — never references `contacts` or `card_reviews`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `deck_id` | UUID FK → decks, ON DELETE CASCADE | |
| `started_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| `completed_at` | TIMESTAMPTZ | Null if in progress |

**Constraints:**
- Index on `deck_id`

---

### `practice_events`

Immutable log. One row per got-it/missed-it mark during a drill session.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `session_id` | UUID FK → practice_sessions, ON DELETE CASCADE | |
| `deck_person_id` | UUID FK → deck_people, ON DELETE CASCADE | |
| `result` | TEXT NOT NULL CHECK IN (`got_it`, `missed_it`) | |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

**Constraints:**
- Index on `session_id`

Nothing aggregated is persisted: a deck's `last_practiced`/`accuracy` (shown on the deck browser and detail page) is computed on the fly from the most recently *completed* `practice_sessions` row and its `practice_events` (`models/practiceSessions.ts#getDeckProgress`) — a lifetime aggregate was deliberately not chosen, so the number reflects last performance rather than smoothing over history.

---

## `users` (reserved, not implemented)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `email` | TEXT UNIQUE NOT NULL | |
| `password_hash` | TEXT NOT NULL | bcrypt |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

Not implemented; documented here only as the V2 hook. Adding it would be an additive migration (add `users`, add `user_id` FK to every table above, add auth middleware) — no schema changes needed to the tables in this document.

---

## Key Relationships Diagram

```
contacts
 ├── mutual_relationships (many, self-referencing via contacts)
 ├── card_reviews (one per contact)
 └── (synthesized) My People virtual deck

decks (type = 'prebuilt')
 ├── deck_people (many)
 │    └── practice_events (many, via practice_sessions)
 └── practice_sessions (many)
      └── practice_events (many)

study_sessions
 └── review_events (many)
```

Isolation is structural, not just behavioral: `deck_people`/`practice_sessions`/`practice_events` never reference `contacts`, `card_reviews`, or `study_sessions`, and vice versa.

---

## SM-2 Notes (My People only)

My People uses a single card type: photo on front, name + where-met + mnemonic on back (see PRD §5.5 for which fields actually render). Only contacts with a `photo_path` are eligible for study sessions.

The SM-2 algorithm updates `ease_factor`, `interval_days`, and `repetitions` after each review based on the rating:

- **Again (0):** Reset interval to 1 day, reset repetitions to 0, reduce ease factor
- **Hard (3):** Increase interval slightly, reduce ease factor slightly
- **Good (4):** Standard interval increase using ease factor
- **Easy (5):** Larger interval increase, boost ease factor

`due_at` is set to `now() + interval_days` after each review. Cards are included in a session when `due_at <= now()` or when they have never been reviewed (and have a photo). See SYSTEM_ARCHITECTURE.md §7 for full session rules.

## Drill Notes (prebuilt decks only)

No scheduling algorithm — every session runs the full deck in a client-shuffled order. Each `deck_person_id` gets exactly one `got_it`/`missed_it` event per session. Accuracy is `got_it_count / total_count` for a given session; see SYSTEM_ARCHITECTURE.md §7b for full session rules.
