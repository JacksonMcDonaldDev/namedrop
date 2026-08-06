# Namedrop

A learning-first name-recall training app. Practice on a ready-made deck of faces within seconds — or build a deck of your own real contacts and study them with spaced repetition.

## Setup

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)

### Docker Compose (recommended)

```bash
cp .env.example .env  # or create .env with DB_PASSWORD=your_password
docker compose up -d          # start db + server
cd client && npm run dev      # start client dev server
```

- Client: http://localhost:3000
- Server API: http://localhost:3001/api/health

### Local Development

**Database:**
```bash
# Start just Postgres (+ server)
docker compose up -d
```

**Server:**
```bash
cd server
npm install
npm run dev
```

**Client:**
```bash
cd client
npm install
npm run dev
```

The client dev server proxies `/api` and `/uploads` requests to the server at `localhost:3001`.

## Testing

```bash
cd server
npm test
```

Server tests use supertest against a dedicated `_test` database, migrated and cleaned automatically.
See `server/tests/README.md` for the pattern and test DB lifecycle.

## Usage

1. **Open the app** — the home screen is a deck browser. A prebuilt **Celebrities** deck (20 faces) is ready to practice immediately; no setup, no data entry.
2. **Practice a deck** — click a deck card to open its detail page. The first visit shows a handful of name-recall technique tips (revisit anytime via the "Technique Tips" button), then click "Start Session" to begin a shuffled, full-screen drill: see the face, reveal to check the name (and mnemonic, if one's set), mark **got it** or **missed it**. A summary screen shows your results when the deck's done.
3. **Add your own people** — open the **My People** deck and click "Add Person." Fill in a first name (the only required field), optionally add a photo, a "where met" note, and a mnemonic — or paste a LinkedIn profile URL to import a name and photo automatically. Click any face in the grid to edit or delete that person.
4. **Study My People** — click "Start Studying" on the My People deck (or "Study Now" from its card on the browser). Due contacts are studied first; if nothing is due, the session covers everyone with a photo (practice mode). View the photo, try to recall the name, then rate: Again / Hard / Good / Easy. Cards are scheduled using the SM-2 spaced repetition algorithm.

The two deck types are intentionally different jobs: prebuilt decks are quick technique reps on safe, recognizable faces; My People is for durably remembering the specific people you've actually met, and keeps its own progress completely separate from prebuilt-deck results.

## Status

The pivot to a learning-first, deck-based app is complete: deck browser home, prebuilt Celebrities deck with drill sessions, and My People (contact management + SM-2 study) unified inside the deck model. Mutual relationships have a full backend but no UI yet, and the contact form currently exposes only name, where-met, and mnemonic fields. See `PRD.md` §11 and `SYSTEM_ARCHITECTURE.md` §12 for the detailed implementation status, and `PRD.md`/`DATA_MODEL.md`/`SYSTEM_ARCHITECTURE.md` for the full product and technical picture.
