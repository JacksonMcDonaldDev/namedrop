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
