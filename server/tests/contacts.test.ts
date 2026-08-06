import fs from 'fs/promises';
import path from 'path';
import request from 'supertest';
import sharp from 'sharp';
import app from '../src/app';

const PHOTOS_DIR = path.join(__dirname, '..', 'uploads', 'photos');

// Fixture images are generated, never committed: sharp is already a server
// dependency, so a few bytes of real JPEG/PNG cost nothing to make here.
function makeImage(format: 'jpeg' | 'png' = 'jpeg'): Promise<Buffer> {
  const image = sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 200, g: 30, b: 30 } },
  });
  return (format === 'png' ? image.png() : image.jpeg()).toBuffer();
}

// Uploads land on disk under server/uploads/photos, outside the database the
// lifecycle hook truncates — so anything a test writes there gets removed here.
const writtenPhotos: string[] = [];
function trackPhoto(photoPath: string | null | undefined) {
  if (photoPath) writtenPhotos.push(path.join(PHOTOS_DIR, path.basename(photoPath)));
}
afterEach(async () => {
  await Promise.all(writtenPhotos.splice(0).map(p => fs.rm(p, { force: true })));
});

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

describe('contact photo upload', () => {
  it('stores an uploaded photo on create and serves it back', async () => {
    const created = await request(app)
      .post('/api/contacts')
      .field('first_name', 'Ada')
      .field('last_name', 'Lovelace')
      .attach('photo', await makeImage(), 'ada.jpg');
    expect(created.status).toBe(201);
    trackPhoto(created.body.photo_path);

    expect(created.body.photo_path).toBe(`/uploads/photos/${created.body.id}.jpg`);

    const fetched = await request(app).get(`/api/contacts/${created.body.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.photo_path).toBe(created.body.photo_path);

    // The stored file is really there and really an image: the app serves
    // /uploads/photos statically, so the same seam that the client uses works.
    const served = await request(app).get(created.body.photo_path).responseType('blob');
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/jpeg');
    expect(served.body.length).toBeGreaterThan(0);
  });

  it('normalizes a PNG upload to JPEG', async () => {
    const created = await request(app)
      .post('/api/contacts')
      .field('first_name', 'Grace')
      .attach('photo', await makeImage('png'), 'grace.png');
    expect(created.status).toBe(201);
    trackPhoto(created.body.photo_path);

    expect(created.body.photo_path).toBe(`/uploads/photos/${created.body.id}.jpg`);
    const served = await request(app).get(created.body.photo_path).responseType('blob');
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/jpeg');
    const meta = await sharp(served.body as Buffer).metadata();
    expect(meta.format).toBe('jpeg');
  });

  it('accepts contact fields as a JSON "data" part alongside the file', async () => {
    const created = await request(app)
      .post('/api/contacts')
      .field('data', JSON.stringify({ first_name: 'Katherine', company: 'NASA', mnemonic: 'katharsis' }))
      .attach('photo', await makeImage(), 'katherine.jpg');
    expect(created.status).toBe(201);
    trackPhoto(created.body.photo_path);

    expect(created.body).toMatchObject({ first_name: 'Katherine', company: 'NASA', mnemonic: 'katharsis' });
    expect(created.body.photo_path).toBe(`/uploads/photos/${created.body.id}.jpg`);
  });

  it('attaches a photo to an existing contact on update', async () => {
    const created = await request(app).post('/api/contacts').send({ first_name: 'Alan' });
    expect(created.status).toBe(201);
    expect(created.body.photo_path).toBeNull();

    const updated = await request(app)
      .put(`/api/contacts/${created.body.id}`)
      .field('last_name', 'Turing')
      .attach('photo', await makeImage(), 'alan.jpg');
    expect(updated.status).toBe(200);
    trackPhoto(updated.body.photo_path);

    expect(updated.body).toMatchObject({
      last_name: 'Turing',
      photo_path: `/uploads/photos/${created.body.id}.jpg`,
    });

    const fetched = await request(app).get(`/api/contacts/${created.body.id}`);
    expect(fetched.body.photo_path).toBe(updated.body.photo_path);
    expect((await request(app).get(updated.body.photo_path)).status).toBe(200);
  });

  it('clears the photo when remove_photo is set', async () => {
    const created = await request(app)
      .post('/api/contacts')
      .field('first_name', 'Ada')
      .attach('photo', await makeImage(), 'ada.jpg');
    trackPhoto(created.body.photo_path);
    const photoUrl: string = created.body.photo_path;

    const cleared = await request(app)
      .put(`/api/contacts/${created.body.id}`)
      .send({ remove_photo: true });
    expect(cleared.status).toBe(200);
    expect(cleared.body.photo_path).toBeNull();

    expect((await request(app).get(`/api/contacts/${created.body.id}`)).body.photo_path).toBeNull();
    expect((await request(app).get(photoUrl)).status).toBe(404);
  });

  it('removes the stored file when the contact is deleted', async () => {
    const created = await request(app)
      .post('/api/contacts')
      .field('first_name', 'Ada')
      .attach('photo', await makeImage(), 'ada.jpg');
    trackPhoto(created.body.photo_path);
    const photoUrl: string = created.body.photo_path;

    expect((await request(app).delete(`/api/contacts/${created.body.id}`)).status).toBe(204);
    expect((await request(app).get(photoUrl)).status).toBe(404);
    expect((await request(app).get(`/api/contacts/${created.body.id}`)).status).toBe(404);
  });

  it('rejects a non-image upload', async () => {
    const rejected = await request(app)
      .post('/api/contacts')
      .field('first_name', 'Ada')
      .attach('photo', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });

    // The rejection names the allowed types rather than falling through to a
    // generic 500 — multer's fileFilter rejects with an AppError so the error
    // handler can map it.
    expect(rejected.status).toBe(400);
    expect(rejected.body).toEqual({ error: 'Only JPEG, PNG, and WebP images are allowed' });

    // Nothing was persisted for the rejected request.
    const listed = await request(app).get('/api/contacts');
    expect(listed.body).toEqual([]);
  });

  it('still requires first_name when the request is multipart', async () => {
    const rejected = await request(app)
      .post('/api/contacts')
      .field('last_name', 'Lovelace')
      .attach('photo', await makeImage(), 'ada.jpg');
    expect(rejected.status).toBe(400);
    expect(rejected.body).toEqual({ error: 'first_name is required' });

    expect((await request(app).get('/api/contacts')).body).toEqual([]);
  });
});
