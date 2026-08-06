# Product Requirements Document: Namedrop

**Version:** 2.0
**Date:** 2026-03-05 (rewritten 2026-08-06 for the learning-first deck pivot — see §11)

---

## 1. Overview

Namedrop is a learning-first name-recall training app, organized around **decks**. It teaches concrete techniques for remembering names and faces and lets a user start practicing on ready-made faces within seconds of opening it — no data entry required. A user's own contacts are a supporting feature, not the price of admission: they live in a **My People** deck that keeps the app's original spaced-repetition (SM-2) study flow for durably remembering real people.

The core insight: gating the app's value behind contact entry buried the thing it's supposed to train (name recall) under its highest-friction feature, and quizzing alone never taught *how* to remember a name. A prebuilt **Celebrities** deck removes both problems — it's instantly playable and pairs every session with concrete technique tips — while My People remains for the specific people a user actually needs to remember.

---

## 2. Problem Statement

People regularly meet new contacts, browse professional networks, or otherwise need to get better at remembering names and faces, but:
- Existing tools require tedious data entry (finding photos, filling in details) before any practice can happen
- Nothing teaches the *technique* of name recall — quizzing alone doesn't build the skill
- Contact apps (phone books, CRMs) store data but provide no active-recall mechanism at all

Famous faces are a deliberate shortcut around the first two problems: the technique can be practiced immediately, on faces that are already safe and recognizable, before ever asking a user to do data entry of their own.

---

## 3. Goals

- **Primary:** Teach and let users practice concrete name-recall technique, starting within seconds of opening the app, using ready-made decks
- **Secondary:** Help users durably remember the specific real people in their life, via spaced repetition
- **Scope:** Web app organized around a deck model — prebuilt technique-practice decks (Celebrities) and one virtual "My People" deck backed by the user's contacts

---

## 4. Target Users

- Anyone who wants to be better with names and faces in general — the primary audience, served by prebuilt decks with zero setup
- Professionals, networkers, and socially active people who also want to retain names of people they've actually met — served by the secondary My People deck

**Important framing:** My People is not for a user's entire network. It's for *unfamiliar* people — weak ties worth strengthening — same framing as the original V1 PRD. Well-known contacts (close friends, longtime colleagues) aren't the target there. The Celebrities deck, by contrast, is deliberately built from well-known faces: familiarity is the point, since it lets the *technique* be practiced safely before difficulty (the stretch tier, and future decks) is introduced.

---

## 5. Feature Set

### 5.1 Deck Browser (Home)

- The home screen (`/`) is a grid of deck cards: the virtual **My People** deck first, then prebuilt decks (currently just **Celebrities**)
- Each card shows the deck's size and a progress signal — due-card count for My People, last-practiced time + accuracy for prebuilt decks
- Clicking a card opens that deck's detail page

### 5.2 Deck Detail

- A grid of faces (photo + name) previews everyone in the deck
- 3–5 static name-recall technique tips (face-feature association, name elaboration, immediate use, building a quick story, spaced repeat) are shown automatically the first time a deck's detail page loads, and can be reopened anytime via a "Technique Tips" button
- A "Start Session" (prebuilt) or "Start Studying" (My People) action begins practice
- My People only: an "Add Person" button, and each face in the grid is clickable to edit that person

### 5.3 Prebuilt Decks & Drill Sessions

- **Celebrities** deck: 20 people (12 instantly recognizable, 8 half-recognizable "stretch tier"), seeded as a one-off from Wikimedia Commons headshots with author/source/license attribution recorded per person
- **Drill session:** the full deck, shuffled client-side, one face at a time — face shown first, "Reveal" shows the name and the person's mnemonic (if one exists), user self-rates **got it** / **missed it**
- Runs full-screen with navigation hidden, matching the distraction-free treatment of My People's study mode — deliberately does not reuse the four-button Again/Hard/Good/Easy rating scale
- A summary screen closes the session: got-it/missed-it counts, accuracy, and a per-person breakdown
- Progress (last practiced, accuracy) is computed from the most recently *completed* session's events, not stored as an aggregate
- Fully isolated from SM-2: drill data lives in its own `practice_sessions`/`practice_events` tables and never touches `contacts` or `card_reviews`, so celebrity performance can never leak into real-contact study signal

### 5.4 My People (Contact Management + SM-2 Study)

- A **virtual** deck backed by the `contacts` table — it has no row of its own in `decks`; it's synthesized at the API layer
- Contact management lives entirely inside the deck: "Add Person" and clicking a face (to edit/delete) route into the existing contact form — LinkedIn import, photo upload, mnemonic field, and placeholder-match detection all carry over unchanged
- "Start Studying" launches the existing SM-2 study session, unchanged: due queue, Again/Hard/Good/Easy self-rating, "again" re-queueing, session summary
- Inviting empty state ("Add the people you actually need to remember.") when there are no contacts yet

### 5.5 Contact Fields

Each contact (My People) supports the following fields:

| Field | Type | Notes |
|---|---|---|
| First Name | Text | Required — only required field |
| Last Name | Text | |
| Email | Text | In schema/API; no form UI — see §11 |
| Phone | Text | In schema/API; no form UI — see §11 |
| Company | Text | In schema/API; no form UI — see §11 |
| Relationship | Select/Text | In schema/API; no form UI — see §11 |
| Mutual Relationships | Hybrid | Links to contacts or placeholders. Backend complete; no UI — see §11 |
| Where Met | Text | Free text, e.g. "AWS re:Invent 2025, Las Vegas" |
| Photo | Image upload | Also importable from a LinkedIn profile URL |
| Mnemonic Device | Text | User-authored memory hook for their name |
| Notes | Long text | In schema/API; no form UI — see §11 |

**Placeholder contacts** (unchanged from V1): name-only records auto-created when an unrecognized name is typed into Mutual Relationships, never shown in My People or study sessions, garbage-collected when nothing references them, promotable to full contacts.

---

## 6. Out of Scope

- **Smart decks** (saved-filter decks) — reserved in the `decks.type` enum, no implementation
- **Coached practice / lesson infrastructure** — technique tips are static content; per-step coaching prompts are a future concern
- **Additional prebuilt decks** beyond Celebrities
- **Reproducible seeding** — the Celebrities roster/images are a one-off insert, not committed seed content; a fresh database starts without them
- Native mobile app (web-first, mobile-responsive)
- Anki file export/import
- AI-generated mnemonic suggestions
- Automatic contact import beyond LinkedIn (Google Contacts, etc.)
- Collaborative or shared contact databases
- Push/email study reminders
- Social graph visualization
- Auth, multi-user, any `user_id` plumbing — Namedrop remains single-user

---

## 7. Technical Direction

- **Frontend:** React 19 (Vite) + Mantine UI, TypeScript
- **Backend:** Node.js + Express — REST API, self-hosted, TypeScript
- **Database:** PostgreSQL — contacts, the typed `decks`/`deck_people` model, SM-2 study state, and drill session/event logs
- **Photo storage:** Local filesystem (self-hosted); path stored in DB. Prebuilt-deck photos live in a separate directory from user-uploaded contact photos
- **Auth:** None — single-user, unchanged from V1
- **Deployment:** Self-hosted (Docker Compose for db + server; client run locally in dev)
- **Testing:** Jest + Supertest against a real Postgres test database, driving the Express app over HTTP (see `server/tests/README.md`)

---

## 8. Key UX Principles

- **Instant playability:** the Celebrities deck is fully playable within seconds of first load — no onboarding wizard, no required data entry
- **Deck as the unifying model:** everything you practice is a deck; prebuilt and virtual decks share one browsing/detail surface even though their session mechanics differ
- **Teach, don't just test:** every deck surfaces concrete technique tips, not just a quiz
- **Distraction-free sessions:** both drill and study sessions run full-screen with navigation hidden
- **Photo-first:** photos remain the anchor for memory in both deck types
- **Speed of contact entry:** adding a My People contact after meeting someone stays fast — minimal required fields, retained from V1

---

## 9. Success Metrics

- A first-time user can start and complete a Celebrities drill session within seconds of first load, with zero setup
- A user can add a real contact with a photo in under 60 seconds (My People, retained from V1)
- A user can go from the deck browser to an active session (drill or study) in one click from a deck card
- Retention: users return to practice on consecutive days, across either deck type

---

## 10. Open Questions

- [x] What spaced repetition algorithm to use? → SM-2 (My People only)
- [x] Should decks be static snapshots or dynamic filters? → Neither, for the shipped model: prebuilt decks are an explicit curated roster; My People is a live view over contacts. Saved-filter ("smart") decks remain a reserved, unimplemented `decks.type` value for a future iteration
- [x] Should "Mutual Relationships" link to contacts in the database, or just be free text? → Hybrid (linked contacts + auto-created placeholders) — backend only, still no UI
- [x] Backend stack: Node.js + Express, separate REST API
- [x] Deployment: Self-hosted, Docker Compose
- [x] Database: PostgreSQL
- [x] Auth: Out of scope. Single-user, no login
- [x] What unifies prebuilt content and personal contacts? → A typed `decks` model, with My People as a virtual deck synthesized from contacts rather than a table row
- [ ] Should prebuilt-deck sessions ever adopt SM-2 scheduling instead of a flat shuffle? → Deferred; explicitly out of scope for this pivot
- [ ] What should the next prebuilt deck be, and does the stretch-tier ratio (12/8) hold at larger sizes? → Deferred

---

## 11. Implementation Status (as of 2026-08-06)

### Built and working
- **Deck browser home** (`/`) — replaces the retired Dashboard; lists My People and all prebuilt decks as cards with size + progress signal
- **Deck detail page** (`/decks/:id`) — people grid, technique tips modal (auto-shown on first visit, reopenable), start-session action, for both deck types
- **Prebuilt Celebrities deck** — 20 seeded people with Wikimedia attribution, served from a dedicated photo directory
- **Drill lifecycle** — full-screen shuffled got-it/missed-it session (`/decks/:id/drill`) with a summary screen; session/event data is DB-backed (`practice_sessions`/`practice_events`), not in-memory, and structurally isolated from SM-2
- **My People unification** — contact management (add/edit/delete, LinkedIn import, photo upload, placeholder-match notification) now lives inside the My People deck detail page; the old standalone Contacts nav/routes are retired
- **SM-2 study**, unchanged: due-card scheduling, Again/Hard/Good/Easy ratings, "again" re-queueing, session summary
- **Automated tests**: Jest + Supertest against a real Postgres test database, covering decks, practice-session lifecycle, contacts, and study endpoints

### Partially built
- **Mutual Relationships (§5.5):** backend is complete — junction table, `GET`/`PUT /contacts/:id/mutuals`, placeholder auto-creation, orphan garbage collection, client API bindings — but **no page in the UI exposes it**. Unchanged from before the pivot.

### Diverged from this PRD
- **Contact fields (§5.5):** the contact form only exposes First Name, Last Name, Where Met, and Mnemonic Device. Email, Phone, Company, Relationship, and Notes exist in the database schema and API but have no form UI, and My People's people grid and study card show only name and mnemonic. Unchanged from before the pivot.
- **Study fallback:** when no cards are due, My People study starts a session over all studyable cards instead of showing "nothing to study" (practice mode by default).

### Not built
- Smart decks (saved-filter decks over contacts)
- Additional prebuilt decks beyond Celebrities
- Auth, multi-user, `user_id` plumbing
- Coached/lesson-based practice content
