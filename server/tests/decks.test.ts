import request from 'supertest';
import app from '../src/app';
import pool from '../src/db';

describe('GET /api/decks', () => {
  it('returns only the virtual My People deck on an unseeded database', async () => {
    const res = await request(app).get('/api/decks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 'my-people', type: 'virtual', name: 'My People', person_count: 0, due_count: 0 },
    ]);
  });

  it('reports correct counts for the virtual deck and any prebuilt decks', async () => {
    const contact = await request(app)
      .post('/api/contacts')
      .send({ first_name: 'Ada', last_name: 'Lovelace', photo_path: '/uploads/photos/ada.jpg' });
    expect(contact.status).toBe(201);

    const { rows: deckRows } = await pool.query(
      `INSERT INTO decks (type, name) VALUES ('prebuilt', 'Celebrities') RETURNING id`
    );
    const deckId = deckRows[0].id;
    await pool.query(
      `INSERT INTO deck_people (deck_id, first_name, last_name) VALUES ($1, 'Tom', 'Hanks'), ($1, 'Meryl', 'Streep')`,
      [deckId]
    );

    const res = await request(app).get('/api/decks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 'my-people', type: 'virtual', name: 'My People', person_count: 1, due_count: 1 },
      {
        id: deckId,
        type: 'prebuilt',
        name: 'Celebrities',
        person_count: 2,
        last_practiced: null,
        accuracy: null,
      },
    ]);
  });
});

describe('GET /api/decks/my-people', () => {
  it('returns the virtual deck detail sourced from contacts', async () => {
    const contact = await request(app)
      .post('/api/contacts')
      .send({ first_name: 'Ada', last_name: 'Lovelace', mnemonic: 'Countess of computing', photo_path: '/uploads/photos/ada.jpg' });
    expect(contact.status).toBe(201);

    const res = await request(app).get('/api/decks/my-people');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'my-people',
      type: 'virtual',
      name: 'My People',
      person_count: 1,
      due_count: 1,
      people: [
        {
          id: contact.body.id,
          first_name: 'Ada',
          last_name: 'Lovelace',
          photo_path: '/uploads/photos/ada.jpg',
          mnemonic: 'Countess of computing',
        },
      ],
    });
  });
});

describe('GET /api/decks/:id', () => {
  it('returns prebuilt deck detail including attribution fields for people', async () => {
    const { rows: deckRows } = await pool.query(
      `INSERT INTO decks (type, name) VALUES ('prebuilt', 'Celebrities') RETURNING id`
    );
    const deckId = deckRows[0].id;
    const { rows: personRows } = await pool.query(
      `INSERT INTO deck_people
         (deck_id, first_name, last_name, photo_path, mnemonic, attribution_author, attribution_source_url, attribution_license)
       VALUES ($1, 'Tom', 'Hanks', '/uploads/decks/tom-hanks.jpg', null, 'Some Author', 'https://commons.wikimedia.org/x', 'CC BY-SA 4.0')
       RETURNING id`,
      [deckId]
    );

    const res = await request(app).get(`/api/decks/${deckId}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: deckId,
      type: 'prebuilt',
      name: 'Celebrities',
      person_count: 1,
      last_practiced: null,
      accuracy: null,
      people: [
        {
          id: personRows[0].id,
          first_name: 'Tom',
          last_name: 'Hanks',
          photo_path: '/uploads/decks/tom-hanks.jpg',
          mnemonic: null,
          attribution_author: 'Some Author',
          attribution_source_url: 'https://commons.wikimedia.org/x',
          attribution_license: 'CC BY-SA 4.0',
        },
      ],
    });
  });

  it('reflects accuracy and last_practiced from a completed drill session', async () => {
    const { rows: deckRows } = await pool.query(
      `INSERT INTO decks (type, name) VALUES ('prebuilt', 'Celebrities') RETURNING id`
    );
    const deckId = deckRows[0].id;
    const { rows: personRows } = await pool.query(
      `INSERT INTO deck_people (deck_id, first_name, last_name) VALUES ($1, 'Tom', 'Hanks') RETURNING id`,
      [deckId]
    );

    const start = await request(app).post(`/api/decks/${deckId}/practice-sessions`);
    const sessionId = start.body.id;
    await request(app)
      .post(`/api/decks/${deckId}/practice-sessions/${sessionId}/events`)
      .send({ deck_person_id: personRows[0].id, result: 'got_it' });
    await request(app).post(`/api/decks/${deckId}/practice-sessions/${sessionId}/complete`);

    const res = await request(app).get(`/api/decks/${deckId}`);
    expect(res.status).toBe(200);
    expect(res.body.accuracy).toBe(1);
    expect(res.body.last_practiced).not.toBeNull();
  });

  it('returns 404 for a deck id that does not exist', async () => {
    const res = await request(app).get('/api/decks/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed deck id', async () => {
    const res = await request(app).get('/api/decks/not-a-uuid');
    expect(res.status).toBe(400);
  });
});

describe('deck_people isolation', () => {
  it('never appears in the contacts list or the SM-2 due queue', async () => {
    await request(app)
      .post('/api/contacts')
      .send({ first_name: 'Ada', last_name: 'Lovelace', photo_path: '/uploads/photos/ada.jpg' });

    const { rows: deckRows } = await pool.query(
      `INSERT INTO decks (type, name) VALUES ('prebuilt', 'Celebrities') RETURNING id`
    );
    await pool.query(
      `INSERT INTO deck_people (deck_id, first_name, last_name) VALUES ($1, 'Tom', 'Hanks')`,
      [deckRows[0].id]
    );

    const contacts = await request(app).get('/api/contacts');
    expect(contacts.status).toBe(200);
    expect(contacts.body).toHaveLength(1);
    expect(contacts.body.every((c: { first_name: string }) => c.first_name !== 'Tom')).toBe(true);

    const session = await request(app).post('/api/study/sessions');
    expect(session.status).toBe(201);
    expect(session.body.card.first_name).toBe('Ada');
    expect(session.body.remaining).toBe(0);
  });
});
