import request from 'supertest';
import app from '../src/app';

// POST /api/linkedin/scrape fetches a real linkedin.com page when it is handed a
// well-formed profile URL, so these tests deliberately stop at the last point
// before the network: missing/malformed input, which the route rejects from a
// local regex check before any fetch() happens. Anything past that (OG-tag
// parsing, name/company splitting, photo download) is not reachable at the HTTP
// seam without either hitting LinkedIn or mocking fetch, and this suite does
// neither — see tests/README.md.
describe('POST /api/linkedin/scrape', () => {
  it('rejects a request with no url', async () => {
    const res = await request(app).post('/api/linkedin/scrape').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'LinkedIn URL is required' });
  });

  it('rejects an empty url', async () => {
    const res = await request(app).post('/api/linkedin/scrape').send({ url: '' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'LinkedIn URL is required' });
  });

  it('rejects a non-string url', async () => {
    const res = await request(app).post('/api/linkedin/scrape').send({ url: 42 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'LinkedIn URL is required' });
  });

  it.each([
    ['a non-LinkedIn host', 'https://example.com/in/ada-lovelace'],
    ['a LinkedIn URL with no scheme', 'linkedin.com/in/ada-lovelace'],
    ['a non-profile LinkedIn path', 'https://www.linkedin.com/company/acme'],
    ['a lookalike host', 'https://linkedin.com.evil.example/in/ada'],
    ['free text', 'ada lovelace'],
  ])('rejects %s without calling out to LinkedIn', async (_label, url) => {
    const res = await request(app).post('/api/linkedin/scrape').send({ url });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid LinkedIn URL/);
  });
});
