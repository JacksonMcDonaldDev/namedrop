import request from 'supertest';
import app from '../src/app';
import pool from '../src/db';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Plants a contact that already carries SM-2 history, the way a real user's row
 * looked before the pivot. There is no HTTP route that can produce a card whose
 * due date is in the past (every review schedules at least a day out), so this
 * fixture is written straight to the tables the migrations define. Only the
 * setup is direct — every assertion below still goes over HTTP.
 */
async function plantContactWithHistory(opts: {
  first_name: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_in_days: number;
  last_reviewed_days_ago: number;
}): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO contacts (first_name, photo_path) VALUES ($1, $2) RETURNING id`,
    [opts.first_name, `/uploads/photos/${opts.first_name.toLowerCase()}.jpg`]
  );
  const contactId: string = rows[0].id;

  await pool.query(
    `INSERT INTO card_reviews (contact_id, ease_factor, interval_days, repetitions, due_at, last_reviewed_at)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval, now() - ($6 || ' days')::interval)`,
    [
      contactId,
      opts.ease_factor,
      opts.interval_days,
      opts.repetitions,
      String(opts.due_in_days),
      String(opts.last_reviewed_days_ago),
    ]
  );

  // A finished session from before the pivot, so the card also has review_events.
  const { rows: sessionRows } = await pool.query(
    `INSERT INTO study_sessions (started_at, completed_at)
     VALUES (now() - ($1 || ' days')::interval, now() - ($1 || ' days')::interval) RETURNING id`,
    [String(opts.last_reviewed_days_ago)]
  );
  await pool.query(
    `INSERT INTO review_events (session_id, contact_id, rating, reviewed_at)
     VALUES ($1, $2, 'good', now() - ($3 || ' days')::interval)`,
    [sessionRows[0].id, contactId, String(opts.last_reviewed_days_ago)]
  );

  return contactId;
}

describe('SM-2 study session lifecycle', () => {
  it('runs start -> review -> complete unchanged now that My People is managed from the deck', async () => {
    const contact = await request(app)
      .post('/api/contacts')
      .send({ first_name: 'Ada', last_name: 'Lovelace', photo_path: '/uploads/photos/ada.jpg' });
    expect(contact.status).toBe(201);

    const start = await request(app).post('/api/study/sessions');
    expect(start.status).toBe(201);
    expect(start.body.card).toMatchObject({ id: contact.body.id, first_name: 'Ada' });
    expect(start.body.remaining).toBe(0);

    const review = await request(app)
      .post(`/api/study/sessions/${start.body.session_id}/review`)
      .send({ contact_id: contact.body.id, rating: 'good' });
    expect(review.status).toBe(200);
    expect(review.body.complete).toBe(true);

    const complete = await request(app).post(`/api/study/sessions/${start.body.session_id}/complete`);
    expect(complete.status).toBe(200);
    expect(complete.body).toMatchObject({ total_reviewed: 1, again: 0, hard: 0, good: 1, easy: 0 });
  });

  it('reports study status reflecting contacts managed through the My People deck', async () => {
    const empty = await request(app).get('/api/study/status');
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ due_count: 0, next_due: null });

    const contact = await request(app)
      .post('/api/contacts')
      .send({ first_name: 'Grace', last_name: 'Hopper', photo_path: '/uploads/photos/grace.jpg' });
    expect(contact.status).toBe(201);

    const withDue = await request(app).get('/api/study/status');
    expect(withDue.status).toBe(200);
    expect(withDue.body.due_count).toBe(1);
  });
});

// Story 27: review history and scheduling state that existed before the pivot
// must survive it — a real contact's progress is not allowed to reset.
describe('pre-existing SM-2 state survives the pivot', () => {
  // Overdue by three days, four repetitions deep on a 12-day interval.
  const overdue = {
    first_name: 'Ada',
    ease_factor: 2.36,
    interval_days: 12,
    repetitions: 4,
    due_in_days: -3,
    last_reviewed_days_ago: 15,
  };
  // Well-established card scheduled far into the future — must stay out of the queue.
  const scheduled = {
    first_name: 'Grace',
    ease_factor: 2.6,
    interval_days: 30,
    repetitions: 6,
    due_in_days: 60,
    last_reviewed_days_ago: 30,
  };

  it('queues only the card that is actually due', async () => {
    const adaId = await plantContactWithHistory(overdue);
    await plantContactWithHistory(scheduled);

    const status = await request(app).get('/api/study/status');
    expect(status.status).toBe(200);
    expect(status.body.due_count).toBe(1);
    // next_due reports the future card, proving it is tracked but not due.
    const nextDue = new Date(status.body.next_due).getTime();
    expect(nextDue - Date.now()).toBeGreaterThan(59 * DAY_MS);

    const start = await request(app).post('/api/study/sessions');
    expect(start.status).toBe(201);
    expect(start.body.card.id).toBe(adaId);
    expect(start.body.card.first_name).toBe('Ada');
    // Grace is not in the queue: the only card is Ada, with nothing behind her.
    expect(start.body.remaining).toBe(0);
  });

  it('resumes SM-2 from the stored interval, ease and repetition count', async () => {
    const adaId = await plantContactWithHistory(overdue);
    await plantContactWithHistory(scheduled);

    const start = await request(app).post('/api/study/sessions');
    const review = await request(app)
      .post(`/api/study/sessions/${start.body.session_id}/review`)
      .send({ contact_id: adaId, rating: 'good' });
    expect(review.status).toBe(200);
    expect(review.body.complete).toBe(true);

    // A card resumed from repetitions=4, interval=12, ease=2.36 schedules
    // round(12 * 2.36) = 28 days out. A reset card would have gone out 1 day.
    const status = await request(app).get('/api/study/status');
    expect(status.body.due_count).toBe(0);
    const nextDueInDays = (new Date(status.body.next_due).getTime() - Date.now()) / DAY_MS;
    expect(nextDueInDays).toBeGreaterThan(27.9);
    expect(nextDueInDays).toBeLessThan(28.1);

    // The pre-pivot review_events belong to their own historical session, so the
    // new session's summary counts only what was reviewed just now.
    const complete = await request(app).post(`/api/study/sessions/${start.body.session_id}/complete`);
    expect(complete.status).toBe(200);
    expect(complete.body).toMatchObject({ total_reviewed: 1, again: 0, hard: 0, good: 1, easy: 0 });
  });

  it('leaves scheduling state untouched when decks and contacts are merely browsed', async () => {
    const adaId = await plantContactWithHistory(overdue);
    await plantContactWithHistory(scheduled);

    const before = await request(app).get('/api/study/status');

    // Everything a user does on the way to studying: list contacts, open one,
    // look at the deck list and the My People deck.
    expect((await request(app).get('/api/contacts')).status).toBe(200);
    expect((await request(app).get(`/api/contacts/${adaId}`)).status).toBe(200);
    expect((await request(app).get('/api/contacts?search=Ada')).status).toBe(200);
    expect((await request(app).get('/api/decks')).status).toBe(200);
    expect((await request(app).get('/api/decks/my-people')).status).toBe(200);

    const after = await request(app).get('/api/study/status');
    expect(after.body).toEqual(before.body);

    // Browsing did not quietly reset the card either: the next review still
    // compounds from the stored interval and ease rather than starting over.
    const start = await request(app).post('/api/study/sessions');
    expect(start.body.card.id).toBe(adaId);
    await request(app)
      .post(`/api/study/sessions/${start.body.session_id}/review`)
      .send({ contact_id: adaId, rating: 'good' });

    const status = await request(app).get('/api/study/status');
    const nextDueInDays = (new Date(status.body.next_due).getTime() - Date.now()) / DAY_MS;
    expect(nextDueInDays).toBeGreaterThan(27.9);
    expect(nextDueInDays).toBeLessThan(28.1);
  });
});
