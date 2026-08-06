# Server tests

Tests drive the Express app over HTTP with [supertest](https://github.com/ladjs/supertest), against a
real Postgres database — never by calling model/service functions directly. Assert on responses
(and on what a subsequent request returns), not on internal state or table shape.

## Adding a test

Add a `*.test.ts` file under `server/tests/`. Import the app and hit it with supertest:

```ts
import request from 'supertest';
import app from '../src/app';

it('does the thing', async () => {
  const res = await request(app).get('/api/some-endpoint');
  expect(res.status).toBe(200);
});
```

`src/app.ts` exports the Express app with no side effects (no `listen`, no migrations) precisely so
it can be imported like this in tests. Startup behavior (`waitForDb`, `runMigrations`, `app.listen`)
lives in `src/server.ts`, which is the actual `npm run dev` / `npm start` entry point.

## Test database lifecycle

Tests never touch the dev database. `DATABASE_URL`'s database name gets `_test` appended (e.g.
`namedrop` -> `namedrop_test`) — see `tests/testDatabaseUrl.js`.

- `tests/globalSetup.js` runs once before the whole suite: drops and recreates the test database,
  then applies every file in `server/migrations/` in order. Every run starts from a clean, fully
  migrated schema, regardless of what a previous run left behind.
- `tests/setupEnv.js` runs in each test worker before any test file is loaded, and repoints
  `process.env.DATABASE_URL` at the test database so `src/db.ts`'s pool never opens against dev data.
- `tests/setupTestLifecycle.ts` truncates every table before each test (`beforeEach`) and closes the
  pool after each file's tests finish (`afterAll`). New tables added by future migrations are picked
  up automatically — nothing to update here when the schema grows.

## Patterns worth reusing

**Binary fixtures are generated, not committed.** `sharp` is a server dependency, so an upload test
builds its own image in-process and hands it to supertest's `.attach()`:

```ts
const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#c81e1e' } })
  .jpeg().toBuffer();
await request(app).post('/api/contacts').field('first_name', 'Ada').attach('photo', jpeg, 'ada.jpg');
```

Uploads land in `server/uploads/photos`, which the `beforeEach` truncate does not reach — an upload
test must delete what it wrote in its own `afterEach` (see `contacts.test.ts`).

**Planting state no route can produce.** A few behaviors only show up on data that predates the
request under test — e.g. an SM-2 card whose `due_at` is in the past, which no review can create
because every review schedules at least a day out. Those fixtures are inserted directly into the
tables the migrations define, and only the fixture is direct: every assertion still goes over HTTP
(see `plantContactWithHistory` in `study.test.ts`).

**Tests never touch the network.** `POST /api/linkedin/scrape` fetches linkedin.com for any
well-formed profile URL, so `linkedin.test.ts` covers only what the service rejects locally, before
its first `fetch()`: missing, non-string, and malformed URLs. Response parsing stays uncovered
rather than being tested against a live third party.

## Running

```bash
cd server
npm test
```

Requires a reachable Postgres server (the one `DATABASE_URL` points at) with permission to create
databases — the same user/role the app already uses in Docker Compose. Tests run with
`--runInBand`: they share one physical test database, so running test files concurrently would let
one file's `beforeEach` truncate wipe out another file's in-flight request.
