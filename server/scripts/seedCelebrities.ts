/**
 * One-off insert: populates the Celebrities prebuilt deck (issue #4).
 * Not part of the migrate-on-boot flow and not intended to be reproducible seeding —
 * see PRD.md "Seed content". Run manually with: npx tsx scripts/seedCelebrities.ts
 */
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import pool from '../src/db';
import roster from './celebrities-roster.json';

const PHOTOS_DIR = path.join(__dirname, '..', 'uploads', 'celebrity-photos');
const DECK_NAME = 'Celebrities';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(imageUrl: string, attempts = 4): Promise<Response> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NameDropSeedScript/1.0; +https://example.com/contact)',
        'Accept': 'image/avif,image/webp,*/*',
      },
    });
    if (res.ok) return res;
    if (res.status === 429 && attempt < attempts) {
      const retryAfter = Number(res.headers.get('retry-after')) || 10;
      console.log(`  rate limited, waiting ${retryAfter}s...`);
      await sleep(retryAfter * 1000);
      continue;
    }
    throw new Error(`Failed to fetch ${imageUrl}: ${res.status} ${res.statusText}`);
  }
  throw new Error(`Failed to fetch ${imageUrl} after ${attempts} attempts`);
}

async function fetchAndProcess(imageUrl: string, personId: string): Promise<string> {
  const res = await fetchWithRetry(imageUrl);
  const buffer = Buffer.from(await res.arrayBuffer());

  await fs.mkdir(PHOTOS_DIR, { recursive: true });
  const filename = `${personId}.jpg`;
  const outputPath = path.join(PHOTOS_DIR, filename);

  await sharp(buffer)
    .rotate()
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(outputPath);

  return `/uploads/celebrity-photos/${filename}`;
}

async function main() {
  const { rows: existing } = await pool.query(
    `SELECT id FROM decks WHERE type = 'prebuilt' AND name = $1`,
    [DECK_NAME]
  );
  if (existing.length > 0) {
    console.log(`"${DECK_NAME}" deck already exists (id ${existing[0].id}) — nothing to do.`);
    await pool.end();
    return;
  }

  const { rows: deckRows } = await pool.query(
    `INSERT INTO decks (type, name) VALUES ('prebuilt', $1) RETURNING id`,
    [DECK_NAME]
  );
  const deckId = deckRows[0].id;

  const substitutions: Array<{ substitutionFor: string; name: string; reason: string }> = [];

  for (const person of roster as Array<Record<string, string>>) {
    const personId = randomUUID();
    console.log(`Fetching ${person.first_name} ${person.last_name}...`);
    const photoPath = await fetchAndProcess(person.image_url, personId);
    await sleep(2500);

    await pool.query(
      `INSERT INTO deck_people
         (id, deck_id, first_name, last_name, photo_path, attribution_author, attribution_source_url, attribution_license)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        personId,
        deckId,
        person.first_name,
        person.last_name || null,
        photoPath,
        person.author,
        person.source_url,
        person.license,
      ]
    );

    if (person.substitutionFor) {
      substitutions.push({
        substitutionFor: person.substitutionFor,
        name: `${person.first_name} ${person.last_name}`.trim(),
        reason: person.substitutionReason,
      });
    }
  }

  console.log(`\nInserted "${DECK_NAME}" deck (id ${deckId}) with ${roster.length} people.`);

  if (substitutions.length > 0) {
    console.log('\nRoster substitutions:');
    for (const s of substitutions) {
      console.log(`- ${s.substitutionFor} -> ${s.name}: ${s.reason}`);
    }
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
