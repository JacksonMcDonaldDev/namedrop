import pool from '../db';
import { getStudyStatus } from './study';

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

  return rows.map(row => ({
    id: row.id,
    type: 'prebuilt' as const,
    name: row.name,
    person_count: row.person_count,
    last_practiced: null,
    accuracy: null,
  }));
}
