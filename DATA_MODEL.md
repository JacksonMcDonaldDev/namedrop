# Data Model: Namedrop

---

## Entity Overview

| Table | Purpose |
|---|---|
| `users` | Authenticated user accounts |
| `contacts` | All contacts — full and placeholder |
| `mutual_relationships` | Junction table linking contacts to their mutual connections |
| `decks` | Named study decks storing a saved filter |
| `card_reviews` | SM-2 state per user + contact + card type |
| `review_events` | Immutable log of every individual card rating |
| `study_sessions` | A single study session against a deck |

---

## Tables

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `email` | TEXT UNIQUE NOT NULL | |
| `password_hash` | TEXT NOT NULL | bcrypt |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### `contacts`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `is_placeholder` | BOOLEAN NOT NULL DEFAULT false | Placeholder = name only, not in study decks |
| `first_name` | TEXT NOT NULL | Only required field |
| `last_name` | TEXT | |
| `email` | TEXT | Null for placeholders |
| `phone` | TEXT | Null for placeholders |
| `company` | TEXT | |
| `relationship` | TEXT | e.g. colleague, client, acquaintance |
| `where_met` | TEXT | |
| `photo_path` | TEXT | Server-relative path to uploaded image. Required for study session eligibility. |
| `mnemonic` | TEXT | Memory hook for their name |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Notes:**
- Placeholders have `is_placeholder = true` and only `first_name`, `last_name`, and `user_id` are meaningful
- Full contacts have `is_placeholder = false` and appear in contact lists and study sessions
- Index on `(user_id, is_placeholder)` for filtering

---

### `mutual_relationships`

Junction table. Each row means: "contact A considers contact B a mutual connection."

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

**Note:** Garbage collection of placeholders is handled at the application layer, triggered after any insert, update, or delete on this table.

---

### `decks`

Decks store a filter/query, not a list of contacts. The set of contacts in a deck is computed at session time.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `name` | TEXT NOT NULL | User-defined deck name |
| `filter` | JSONB | Filter criteria — see filter schema below |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Filter schema (JSONB):**
```json
{
  "relationship": ["colleague", "client"],
  "company": ["Acme Corp"],
  "where_met": "re:Invent",
  "added_after": "2025-01-01",
  "added_before": "2026-01-01"
}
```
All fields optional. An empty filter `{}` matches all non-placeholder contacts for the user.

---

### `card_reviews`

Stores the current SM-2 scheduling state for each (user, contact, card_type) combination. A row is created on first review and updated on every subsequent review.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `contact_id` | UUID FK → contacts | |
| `card_type` | TEXT NOT NULL | `name_recall` in V1. Column retained for future card types. |
| `ease_factor` | FLOAT NOT NULL DEFAULT 2.5 | SM-2 ease factor |
| `interval_days` | INTEGER NOT NULL DEFAULT 0 | Days until next review |
| `repetitions` | INTEGER NOT NULL DEFAULT 0 | Consecutive successful reviews |
| `due_at` | TIMESTAMPTZ | When this card is next due |
| `last_reviewed_at` | TIMESTAMPTZ | |

**Constraints:**
- UNIQUE on `(user_id, contact_id, card_type)`

---

### `review_events`

Immutable log. One row per card rating during a study session. Source of truth for session summaries and future analytics.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `session_id` | UUID FK → study_sessions | |
| `user_id` | UUID FK → users | Denormalized for query convenience |
| `contact_id` | UUID FK → contacts | |
| `card_type` | TEXT NOT NULL | `name_recall` in V1. Column retained for future card types. |
| `rating` | TEXT NOT NULL | `again`, `hard`, `good`, `easy` |
| `reviewed_at` | TIMESTAMPTZ | |

---

### `study_sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `deck_id` | UUID FK → decks | |
| `started_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ | Null if in progress |

---

## Key Relationships Diagram

```
users
 ├── contacts (many)
 │    └── mutual_relationships (many, self-referencing via contacts)
 ├── decks (many)
 │    └── study_sessions (many)
 │         └── review_events (many)
 └── card_reviews (many, keyed per contact + card_type)
```

---

## SM-2 Notes

V1 uses a single card type (`name_recall`): photo on front, all contact details on back. Only contacts with a `photo_path` are eligible for study sessions.

The SM-2 algorithm updates `ease_factor`, `interval_days`, and `repetitions` after each review based on the rating:

- **Again (0):** Reset interval to 1 day, reset repetitions to 0, reduce ease factor
- **Hard (3):** Increase interval slightly, reduce ease factor slightly
- **Good (4):** Standard interval increase using ease factor
- **Easy (5):** Larger interval increase, boost ease factor

`due_at` is set to `now() + interval_days` after each review. Cards are included in a session when `due_at <= now()` or when they have never been reviewed (and have a photo).
