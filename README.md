# Namedrop

Spaced repetition flashcard app for learning names and faces of people you've recently met.

## Setup

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)

### Docker Compose (recommended)

```bash
cp .env.example .env  # or create .env with DB_PASSWORD=your_password
docker compose up
```

- Client: http://localhost:3000
- Server API: http://localhost:3001/api/health

### Local Development

**Database:**
```bash
# Start just Postgres
docker compose up db
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

1. **Add contacts** — Go to Contacts, click "Add Contact", fill in name + photo. Optionally paste a LinkedIn profile URL to import the name and photo, or drag an image (including from another browser window) onto the photo area.
2. **Study** — From the dashboard, click "Study Now". Due cards are studied first; if nothing is due, the session covers all contacts with photos (practice mode).
3. **Rate recall** — View the photo, try to recall the name, then rate: Again / Hard / Good / Easy
4. Cards are scheduled using the SM-2 spaced repetition algorithm

## Status

The V1 core loop (contacts, photos, SM-2 study) is complete. Mutual relationships have a full backend but no UI yet, and the contact form currently exposes only name, where-met, and mnemonic fields. See `PRD.md` §11 and `SYSTEM_ARCHITECTURE.md` §12 for the detailed implementation status.
