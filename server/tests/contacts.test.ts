import request from 'supertest';
import app from '../src/app';

describe('GET /api/contacts', () => {
  it('reflects a contact created by a prior request', async () => {
    const empty = await request(app).get('/api/contacts');
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual([]);

    const created = await request(app)
      .post('/api/contacts')
      .send({ first_name: 'Ada', last_name: 'Lovelace' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ first_name: 'Ada', last_name: 'Lovelace' });

    const listed = await request(app).get('/api/contacts');
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).toMatchObject({ id: created.body.id, first_name: 'Ada' });
  });
});
