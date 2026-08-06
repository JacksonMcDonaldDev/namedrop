import request from 'supertest';
import app from '../src/app';
import pool from '../src/db';

async function seedPrebuiltDeck(name = 'Celebrities') {
  const { rows: deckRows } = await pool.query(
    `INSERT INTO decks (type, name) VALUES ('prebuilt', $1) RETURNING id`,
    [name]
  );
  const deckId = deckRows[0].id;
  const { rows: peopleRows } = await pool.query(
    `INSERT INTO deck_people (deck_id, first_name, last_name)
     VALUES ($1, 'Tom', 'Hanks'), ($1, 'Meryl', 'Streep'), ($1, 'Denzel', 'Washington')
     RETURNING id`,
    [deckId]
  );
  return { deckId, personIds: peopleRows.map((r: { id: string }) => r.id) };
}

describe('Drill lifecycle', () => {
  it('runs start -> events -> complete -> summary over HTTP with counts derived from submitted events', async () => {
    const { deckId, personIds } = await seedPrebuiltDeck();

    const start = await request(app).post(`/api/decks/${deckId}/practice-sessions`);
    expect(start.status).toBe(201);
    expect(start.body).toMatchObject({ deck_id: deckId, completed_at: null });
    const sessionId = start.body.id;

    const ev1 = await request(app)
      .post(`/api/decks/${deckId}/practice-sessions/${sessionId}/events`)
      .send({ deck_person_id: personIds[0], result: 'got_it' });
    expect(ev1.status).toBe(201);

    const ev2 = await request(app)
      .post(`/api/decks/${deckId}/practice-sessions/${sessionId}/events`)
      .send({ deck_person_id: personIds[1], result: 'missed_it' });
    expect(ev2.status).toBe(201);

    const ev3 = await request(app)
      .post(`/api/decks/${deckId}/practice-sessions/${sessionId}/events`)
      .send({ deck_person_id: personIds[2], result: 'got_it' });
    expect(ev3.status).toBe(201);

    const complete = await request(app).post(`/api/decks/${deckId}/practice-sessions/${sessionId}/complete`);
    expect(complete.status).toBe(200);
    expect(complete.body).toEqual({ total: 3, got_it: 2, missed_it: 1, accuracy: 2 / 3 });
  });

  it('populates deck listing last_practiced and accuracy after a completed session', async () => {
    const { deckId, personIds } = await seedPrebuiltDeck();

    const before = await request(app).get('/api/decks');
    const deckBefore = before.body.find((d: { id: string }) => d.id === deckId);
    expect(deckBefore).toMatchObject({ last_practiced: null, accuracy: null });

    const start = await request(app).post(`/api/decks/${deckId}/practice-sessions`);
    const sessionId = start.body.id;
    await request(app)
      .post(`/api/decks/${deckId}/practice-sessions/${sessionId}/events`)
      .send({ deck_person_id: personIds[0], result: 'got_it' });
    await request(app)
      .post(`/api/decks/${deckId}/practice-sessions/${sessionId}/events`)
      .send({ deck_person_id: personIds[1], result: 'missed_it' });
    await request(app).post(`/api/decks/${deckId}/practice-sessions/${sessionId}/complete`);

    const after = await request(app).get('/api/decks');
    const deckAfter = after.body.find((d: { id: string }) => d.id === deckId);
    expect(deckAfter.accuracy).toBeCloseTo(0.5);
    expect(deckAfter.last_practiced).not.toBeNull();
  });

  it('leaves SM-2 study state untouched by drill activity', async () => {
    await request(app)
      .post('/api/contacts')
      .send({ first_name: 'Ada', last_name: 'Lovelace', photo_path: '/uploads/photos/ada.jpg' });

    const statusBefore = await request(app).get('/api/study/status');
    expect(statusBefore.body.due_count).toBe(1);

    const { deckId, personIds } = await seedPrebuiltDeck();
    const start = await request(app).post(`/api/decks/${deckId}/practice-sessions`);
    const sessionId = start.body.id;
    await request(app)
      .post(`/api/decks/${deckId}/practice-sessions/${sessionId}/events`)
      .send({ deck_person_id: personIds[0], result: 'got_it' });
    await request(app).post(`/api/decks/${deckId}/practice-sessions/${sessionId}/complete`);

    const statusAfter = await request(app).get('/api/study/status');
    expect(statusAfter.body.due_count).toBe(1);

    const contacts = await request(app).get('/api/contacts');
    expect(contacts.body).toHaveLength(1);

    const session = await request(app).post('/api/study/sessions');
    expect(session.status).toBe(201);
    expect(session.body.card.first_name).toBe('Ada');
  });

  it('survives a server restart: an in-flight session still accepts events after the app module is fully reloaded', async () => {
    const { deckId, personIds } = await seedPrebuiltDeck();
    const start = await request(app).post(`/api/decks/${deckId}/practice-sessions`);
    const sessionId = start.body.id;

    // Simulate a server restart by dropping the module registry and re-requiring
    // the app fresh — any state kept in a module-level variable (e.g. an
    // in-memory Map, as study.ts's session queues use) would not survive this.
    jest.resetModules();
    const freshApp = require('../src/app').default;
    const freshDb = require('../src/db').default;

    try {
      const ev = await request(freshApp)
        .post(`/api/decks/${deckId}/practice-sessions/${sessionId}/events`)
        .send({ deck_person_id: personIds[0], result: 'got_it' });
      expect(ev.status).toBe(201);

      const complete = await request(freshApp).post(
        `/api/decks/${deckId}/practice-sessions/${sessionId}/complete`
      );
      expect(complete.status).toBe(200);
      expect(complete.body).toEqual({ total: 1, got_it: 1, missed_it: 0, accuracy: 1 });
    } finally {
      await freshDb.end();
    }
  });

  describe('invalid flows', () => {
    it('rejects an event for a person not in the deck', async () => {
      const { deckId } = await seedPrebuiltDeck();
      const other = await seedPrebuiltDeck('Other Deck');
      const start = await request(app).post(`/api/decks/${deckId}/practice-sessions`);
      const sessionId = start.body.id;

      const res = await request(app)
        .post(`/api/decks/${deckId}/practice-sessions/${sessionId}/events`)
        .send({ deck_person_id: other.personIds[0], result: 'got_it' });
      expect(res.status).toBe(400);
    });

    it('rejects an event submitted after the session is complete', async () => {
      const { deckId, personIds } = await seedPrebuiltDeck();
      const start = await request(app).post(`/api/decks/${deckId}/practice-sessions`);
      const sessionId = start.body.id;
      await request(app).post(`/api/decks/${deckId}/practice-sessions/${sessionId}/complete`);

      const res = await request(app)
        .post(`/api/decks/${deckId}/practice-sessions/${sessionId}/events`)
        .send({ deck_person_id: personIds[0], result: 'got_it' });
      expect(res.status).toBe(400);
    });

    it('rejects events and completion for an unknown session', async () => {
      const { deckId, personIds } = await seedPrebuiltDeck();
      const fakeSessionId = '00000000-0000-0000-0000-000000000000';

      const event = await request(app)
        .post(`/api/decks/${deckId}/practice-sessions/${fakeSessionId}/events`)
        .send({ deck_person_id: personIds[0], result: 'got_it' });
      expect(event.status).toBe(404);

      const complete = await request(app).post(
        `/api/decks/${deckId}/practice-sessions/${fakeSessionId}/complete`
      );
      expect(complete.status).toBe(404);
    });

    it('rejects starting a session for an unknown deck', async () => {
      const fakeDeckId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app).post(`/api/decks/${fakeDeckId}/practice-sessions`);
      expect(res.status).toBe(404);
    });

    it('rejects starting a session for the virtual My People deck', async () => {
      const res = await request(app).post('/api/decks/my-people/practice-sessions');
      expect(res.status).toBe(400);
    });
  });
});
