# Product Requirements Document: Namedrop

**Version:** 1.1
**Date:** 2026-03-05 (status updated 2026-08-05 — see §11)

---

## 1. Overview

Namedrop is a web application that helps users learn the names and key details of people they've recently met. Users capture contacts — specifically people they *don't yet know well* — and study them through Anki-style spaced repetition flashcard decks until they stick.

The core insight: the problem isn't remembering close friends and colleagues — it's the people on the periphery. The new hire you met at orientation, the client from last week's conference, the friend-of-a-friend you keep running into. Namedrop is built for exactly those people.

---

## 2. Problem Statement

Professionals, networkers, and socially active people regularly meet new contacts but struggle to:
- Retain names and faces after brief encounters
- Remember contextual details (where they met, mutual connections, etc.)
- Build genuine familiarity with people in their network

Existing contact apps (phone books, CRMs) store data but provide no mechanism for active recall or learning.

---

## 3. Goals

- **Primary:** Enable users to actively learn and retain their contacts' names and key details
- **Secondary:** Provide a clean, structured way to capture rich context about contacts at the time of meeting
- **V1 Scope:** Web app with contact management + flashcard deck generation

---

## 4. Target Users

- Professionals who attend networking events, conferences, or client meetings
- Anyone who wants to be better with names and faces
- People re-entering a social or professional scene after time away

**Important framing:** Users are not trying to manage their entire network. They are capturing *unfamiliar* people — weak ties they want to strengthen. Well-known contacts (close friends, longtime colleagues) are not the target. This keeps the database focused and the study sessions high-signal.

---

## 5. V1 Feature Set

### 5.1 Contact Management

Each contact supports the following fields:

| Field | Type | Notes |
|---|---|---|
| First Name | Text | Required — only required field |
| Last Name | Text | |
| Email | Text | Validated format |
| Phone | Text | Formatted display |
| Company | Text | |
| Relationship | Select/Text | e.g. colleague, client, friend, acquaintance |
| Mutual Relationships | Hybrid | Links to contacts or placeholders in the database. Typing an unrecognized name auto-creates a placeholder. |
| Where Met | Text | Free text, e.g. "AWS re:Invent 2025, Las Vegas" |
| Photo | Image upload | Used as the primary flashcard visual |
| Mnemonic Device | Text | User-authored memory hook for their name |
| Notes | Long text | Free-form notes |

**Placeholder contacts:**
- Contacts can be marked as placeholders — name-only records used for referencing people not in the study database
- Placeholders are created automatically when a user types an unrecognized name in the Mutual Relationships field
- Placeholders never appear in the contact list or study sessions
- A placeholder is automatically deleted when no contact's Mutual Relationships field references it (zero references = garbage collected)
- Placeholders can be promoted to full contacts at any time
- When creating a new contact, if the entered name matches an existing placeholder, the user is shown a notification with a prompt to edit that placeholder instead of creating a duplicate — promoting it to a full contact in place, preserving all existing references

**Core contact actions:**
- Create, read, update, delete contacts
- Search and filter contacts
- Browse contacts in a list/grid view

### 5.2 Flashcard Deck Generation

Users can generate Anki-style flashcard decks from their contact database.

**Deck creation:**
- Create a deck from all contacts or a filtered subset (by relationship, company, where met, date added, etc.)
- Decks are **dynamic** — they store a filter/query, not a fixed list. New contacts that match the filter are automatically included in future study sessions.
- Name and save decks for reuse

**Card type (V1): Name Recall**

| Side | Content |
|---|---|
| Front (question) | Contact photo |
| Back (answer) | All available contact details |

**Study session:**
- Only contacts with a photo are eligible for study
- Cards are presented one at a time
- User self-rates recall: Again / Hard / Good / Easy (standard Anki rating)
- SM-2 spaced repetition scheduling
- Session summary on completion (cards reviewed, accuracy)
- Additional card types planned for future versions

### 5.3 User Accounts

- Email/password authentication (V1)
- All data scoped to the authenticated user
- Secure storage of contact photos

---

## 6. Out of Scope (V1)

- Native mobile app (web-first, mobile-responsive)
- Anki file export/import
- AI-generated mnemonic suggestions (future)
- Automatic contact import (LinkedIn, Google Contacts, etc.)
- Collaborative or shared contact databases
- Push/email study reminders
- Social graph visualization

---

## 7. Technical Direction

- **Frontend:** React (Vite) — web, with React Native portability in mind for a future V2
- **Styling:** TBD — likely Tailwind CSS
- **Backend:** Node.js + Express — REST API, self-hosted
- **Database:** PostgreSQL — relational model fits contacts, decks (stored as queries), and study session history well
- **Photo storage:** Local filesystem or volume mount (self-hosted); path stored in DB
- **Auth:** JWT-based — stateless, works well for both web and future native clients
- **Deployment:** Self-hosted (single server or Docker Compose)

---

## 8. Key UX Principles

- **Speed of entry:** Adding a contact after meeting someone should be fast — minimize required fields
- **Photo-first:** Photos are the anchor for memory; the UI should make uploading and displaying photos prominent
- **Clean study mode:** Flashcard study mode should be distraction-free, full-screen capable
- **Mobile-responsive:** Users will often add contacts from their phone immediately after meeting someone

---

## 9. Success Metrics (V1)

- User can add a contact with photo in under 60 seconds
- User can generate and start a study session in under 3 clicks from the dashboard
- Retention: users return to study sessions on consecutive days

---

## 10. Open Questions

- [x] What spaced repetition algorithm to use? → SM-2
- [x] Should "Mutual Relationships" link to contacts in the database, or just be free text in V1? → Hybrid (linked contacts + auto-created placeholders)
- [x] Backend stack: Node.js + Express, separate REST API
- [x] Deployment: Self-hosted
- [x] Database: PostgreSQL
- [x] Deck behavior: Dynamic (decks store a query; contacts matching the filter are always included) — **deferred to V2**
- [x] Mutual Relationships: Hybrid — linked contacts in the DB + free text for people not in the system
- [x] Spaced repetition: SM-2 algorithm
- [x] Should decks be static snapshots or dynamically reflect the current state of contacts? → Dynamic — **deferred to V2**
- [x] Auth: Deferred to V2. V1 is single-user, no login.
- [x] Decks: Deferred to V2. V1 studies all contacts with photos in a single global pool.
- [x] Filter semantics (V2): OR within array fields, AND across fields, ILIKE for text fields, range check for dates.

---

## 11. Implementation Status (as of 2026-08-05)

### Built and working
- Contact CRUD with search (name, company, where met) and list view
- Photo upload with server-side processing (resize, JPEG conversion), drag-and-drop including image URLs dragged from other browser windows
- Study sessions: SM-2 scheduling, Again/Hard/Good/Easy ratings, "again" re-queueing, session summary with rating breakdown
- Dashboard with due-card count and next-due date
- Placeholder-match notification on the contact form: entering a first name that matches an existing placeholder prompts the user to edit/promote it instead (matches on exact first name only)

### Partially built
- **Mutual Relationships (§5.1):** the backend is complete — junction table, `GET`/`PUT /contacts/:id/mutuals` endpoints, placeholder auto-creation, and orphan garbage collection — and the client API layer has bindings for it, but **no page in the UI exposes it**. Mutual relationships cannot currently be viewed or edited in the app.

### Diverged from this PRD
- **Contact fields (§5.1):** the contact form only exposes First Name, Last Name, Where Met, and Mnemonic Device. Email, Phone, Company, Relationship, and Notes exist in the database schema and API but were removed from the form UI, and the study card back shows only name, where met, and mnemonic. Decision pending: reinstate the fields or trim them from the spec.
- **LinkedIn import (§6):** listed as out of scope, but implemented anyway — the Add Contact form accepts a LinkedIn profile URL and imports name + photo via server-side scraping (`POST /api/linkedin/scrape`).
- **Study fallback:** when no cards are due, the app starts a session over all studyable cards instead of showing "nothing to study" (practice mode by default).

### Not built
- Automated tests (none in client or server)
- Everything explicitly deferred to V2 in §10: auth, decks/filters, multiple card types
