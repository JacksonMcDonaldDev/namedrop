# NameDrop - Development Guide

## Stack
- **Client**: React 19 + Vite + Mantine UI + TypeScript (port 3000)
- **Server**: Express + PostgreSQL + TypeScript (port 3001)
- **Infra**: Docker Compose (db + server; client runs locally)

## Start the stack
```bash
docker compose up -d          # start db + server
cd client && npm run dev      # start client dev server
```

## Diagnostic commands
```bash
# Server logs (errors, request log)
docker compose logs --tail=100 server

# Client type checking
cd client && npx tsc --noEmit

# Server type checking
cd server && npx tsc --noEmit

# Database access
docker compose exec db psql -U namedrop -d namedrop
```

## Key paths
- Server entry: `server/src/app.ts`
- API routes: `server/src/routes/`
- Client entry: `client/src/main.tsx`
- Client API layer: `client/src/api/`
- Migrations: `server/src/migrations/`
