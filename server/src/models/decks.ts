import pool from '../db';
import { getStudyStatus } from './study';
import { getDeckProgress, getDeckProgressMap } from './practiceSessions';

export interface VirtualDeckSummary {
  id: 'my-people';
  type: 'virtual';
  name: string;
  person_count: number;
  due_count: number;
}

export interface PrebuiltDeckSummary {
  id: string;
  type: 'prebuilt';
  name: string;
  person_count: number;
  last_practiced: string | null;
  accuracy: number | null;
}

export interface DeckPerson {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_path: string | null;
  mnemonic: string | null;
}

export interface PrebuiltDeckPerson extends DeckPerson {
  attribution_author: string | null;
  attribution_source_url: string | null;
  attribution_license: string | null;
}

export interface VirtualDeckDetail extends VirtualDeckSummary {
  people: DeckPerson[];
}

export interface PrebuiltDeckDetail extends PrebuiltDeckSummary {
  people: PrebuiltDeckPerson[];
}

export async function getMyPeopleDeck(): Promise<VirtualDeckSummary> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int as count FROM contacts WHERE is_placeholder = false`
  );
  const { due_count } = await getStudyStatus();

  return {
    id: 'my-people',
    type: 'virtual',
    name: 'My People',
    person_count: rows[0].count,
    due_count,
  };
}

export async function listPrebuiltDecks(): Promise<PrebuiltDeckSummary[]> {
  const { rows } = await pool.query(`
    SELECT d.id, d.name, COUNT(dp.id)::int as person_count
    FROM decks d
    LEFT JOIN deck_people dp ON dp.deck_id = d.id
    WHERE d.type = 'prebuilt'
    GROUP BY d.id, d.name, d.created_at
    ORDER BY d.created_at ASC
  `);

  const progressByDeck = await getDeckProgressMap(rows.map(row => row.id));

  return rows.map(row => {
    const progress = progressByDeck.get(row.id)!;
    return {
      id: row.id,
      type: 'prebuilt' as const,
      name: row.name,
      person_count: row.person_count,
      last_practiced: progress.last_practiced,
      accuracy: progress.accuracy,
    };
  });
}

export async function getMyPeopleDeckDetail(): Promise<VirtualDeckDetail> {
  const summary = await getMyPeopleDeck();
  const { rows: people } = await pool.query(
    `SELECT id, first_name, last_name, photo_path, mnemonic
     FROM contacts
     WHERE is_placeholder = false
     ORDER BY created_at DESC`
  );

  return { ...summary, people };
}

export async function getPrebuiltDeckDetail(id: string): Promise<PrebuiltDeckDetail | null> {
  const { rows: deckRows } = await pool.query(
    `SELECT id, name FROM decks WHERE id = $1 AND type = 'prebuilt'`,
    [id]
  );
  if (!deckRows[0]) return null;

  const { rows: people } = await pool.query(
    `SELECT id, first_name, last_name, photo_path, mnemonic,
            attribution_author, attribution_source_url, attribution_license
     FROM deck_people
     WHERE deck_id = $1
     ORDER BY created_at ASC`,
    [id]
  );

  const progress = await getDeckProgress(id);

  return {
    id: deckRows[0].id,
    type: 'prebuilt',
    name: deckRows[0].name,
    person_count: people.length,
    last_practiced: progress.last_practiced,
    accuracy: progress.accuracy,
    people,
  };
}
