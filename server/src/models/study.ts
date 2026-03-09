import pool from '../db';
import { Contact } from './contacts';

const MAX_NEW_CARDS = 10;

export interface DueCard {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  relationship: string | null;
  where_met: string | null;
  photo_path: string;
  mnemonic: string | null;
  notes: string | null;
  is_new: boolean;
}

export async function getDueCards(): Promise<DueCard[]> {
  // Overdue cards: have a card_reviews row with due_at <= now
  const { rows: overdueCards } = await pool.query(`
    SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.company,
           c.relationship, c.where_met, c.photo_path, c.mnemonic, c.notes,
           false as is_new
    FROM contacts c
    JOIN card_reviews cr ON cr.contact_id = c.id
    WHERE c.is_placeholder = false
      AND c.photo_path IS NOT NULL
      AND cr.due_at <= now()
    ORDER BY cr.due_at ASC
  `);

  // New cards: no card_reviews row, limited to MAX_NEW_CARDS
  const { rows: newCards } = await pool.query(`
    SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.company,
           c.relationship, c.where_met, c.photo_path, c.mnemonic, c.notes,
           true as is_new
    FROM contacts c
    LEFT JOIN card_reviews cr ON cr.contact_id = c.id
    WHERE c.is_placeholder = false
      AND c.photo_path IS NOT NULL
      AND cr.id IS NULL
    ORDER BY c.created_at ASC
    LIMIT $1
  `, [MAX_NEW_CARDS]);

  return [...overdueCards, ...newCards];
}

export async function getOrCreateCardReview(contactId: string) {
  const { rows } = await pool.query(
    'SELECT * FROM card_reviews WHERE contact_id = $1',
    [contactId]
  );

  if (rows[0]) return rows[0];

  const { rows: created } = await pool.query(
    'INSERT INTO card_reviews (contact_id) VALUES ($1) RETURNING *',
    [contactId]
  );
  return created[0];
}

export async function updateCardReview(
  contactId: string,
  data: { ease_factor: number; interval_days: number; repetitions: number; due_at: Date; last_reviewed_at: Date }
) {
  const { rows } = await pool.query(
    `UPDATE card_reviews
     SET ease_factor = $1, interval_days = $2, repetitions = $3, due_at = $4, last_reviewed_at = $5
     WHERE contact_id = $6
     RETURNING *`,
    [data.ease_factor, data.interval_days, data.repetitions, data.due_at, data.last_reviewed_at, contactId]
  );
  return rows[0];
}

export async function createSession(): Promise<{ id: string; started_at: Date }> {
  const { rows } = await pool.query(
    'INSERT INTO study_sessions DEFAULT VALUES RETURNING *'
  );
  return rows[0];
}

export async function createReviewEvent(sessionId: string, contactId: string, rating: string) {
  const { rows } = await pool.query(
    'INSERT INTO review_events (session_id, contact_id, rating) VALUES ($1, $2, $3) RETURNING *',
    [sessionId, contactId, rating]
  );
  return rows[0];
}

export async function completeSession(sessionId: string) {
  const { rows } = await pool.query(
    'UPDATE study_sessions SET completed_at = now() WHERE id = $1 RETURNING *',
    [sessionId]
  );
  return rows[0];
}

export async function getSessionSummary(sessionId: string) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) as total_reviewed,
       COUNT(*) FILTER (WHERE rating = 'again') as again_count,
       COUNT(*) FILTER (WHERE rating = 'hard') as hard_count,
       COUNT(*) FILTER (WHERE rating = 'good') as good_count,
       COUNT(*) FILTER (WHERE rating = 'easy') as easy_count
     FROM review_events
     WHERE session_id = $1`,
    [sessionId]
  );
  return {
    total_reviewed: parseInt(rows[0].total_reviewed),
    again: parseInt(rows[0].again_count),
    hard: parseInt(rows[0].hard_count),
    good: parseInt(rows[0].good_count),
    easy: parseInt(rows[0].easy_count),
  };
}

export async function getStudyStatus() {
  // Count of due cards
  const { rows: dueRows } = await pool.query(`
    SELECT COUNT(*) as due_count FROM contacts c
    LEFT JOIN card_reviews cr ON cr.contact_id = c.id
    WHERE c.is_placeholder = false
      AND c.photo_path IS NOT NULL
      AND (cr.due_at <= now() OR cr.id IS NULL)
  `);

  // Next due date (for cards not yet due)
  const { rows: nextRows } = await pool.query(`
    SELECT MIN(cr.due_at) as next_due
    FROM card_reviews cr
    JOIN contacts c ON c.id = cr.contact_id
    WHERE c.is_placeholder = false
      AND c.photo_path IS NOT NULL
      AND cr.due_at > now()
  `);

  return {
    due_count: parseInt(dueRows[0].due_count),
    next_due: nextRows[0]?.next_due || null,
  };
}
