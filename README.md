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

## Usage

1. **Add contacts** — Go to Contacts, click "Add Contact", fill in name + photo
2. **Study** — From the dashboard, click "Study Now" when cards are due
3. **Rate recall** — View the photo, try to recall the name, then rate: Again / Hard / Good / Easy
4. Cards are scheduled using the SM-2 spaced repetition algorithm
