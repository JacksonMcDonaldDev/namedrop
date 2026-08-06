import request from 'supertest';
import app from '../src/app';

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
