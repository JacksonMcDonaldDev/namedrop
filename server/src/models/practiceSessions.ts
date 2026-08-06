import pool from '../db';

export interface Deck {
  id: string;
  type: string;
  name: string;
}

export interface PracticeSession {
  id: string;
  deck_id: string;
  started_at: string;
  completed_at: string | null;
}

export interface PracticeEvent {
  id: string;
  session_id: string;
  deck_person_id: string;
  result: 'got_it' | 'missed_it';
  created_at: string;
}

export interface SessionSummary {
  total: number;
  got_it: number;
  missed_it: number;
  accuracy: number | null;
}

export interface DeckProgress {
  last_practiced: string | null;
  accuracy: number | null;
}

const PRACTICE_SESSION_COLUMNS = `id, deck_id, started_at, completed_at`;
const PRACTICE_EVENT_COLUMNS = `id, session_id, deck_person_id, result, created_at`;

export async function getDeck(deckId: string): Promise<Deck | null> {
  const { rows } = await pool.query('SELECT id, type, name FROM decks WHERE id = $1', [deckId]);
  return rows[0] || null;
}

export async function isPersonInDeck(deckId: string, deckPersonId: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT 1 FROM deck_people WHERE id = $1 AND deck_id = $2',
    [deckPersonId, deckId]
  );
  return rows.length > 0;
}

export async function createSession(deckId: string): Promise<PracticeSession> {
  const { rows } = await pool.query(
    `INSERT INTO practice_sessions (deck_id) VALUES ($1) RETURNING ${PRACTICE_SESSION_COLUMNS}`,
    [deckId]
  );
  return rows[0];
}

export async function getSessionForDeck(sessionId: string, deckId: string): Promise<PracticeSession | null> {
  const { rows } = await pool.query(
    `SELECT ${PRACTICE_SESSION_COLUMNS} FROM practice_sessions WHERE id = $1 AND deck_id = $2`,
    [sessionId, deckId]
  );
  return rows[0] || null;
}

export async function createEvent(
  sessionId: string,
  deckPersonId: string,
  result: string
): Promise<PracticeEvent> {
  const { rows } = await pool.query(
    `INSERT INTO practice_events (session_id, deck_person_id, result)
     VALUES ($1, $2, $3) RETURNING ${PRACTICE_EVENT_COLUMNS}`,
    [sessionId, deckPersonId, result]
  );
  return rows[0];
}

export async function completeSession(sessionId: string): Promise<PracticeSession> {
  const { rows } = await pool.query(
    `UPDATE practice_sessions SET completed_at = now() WHERE id = $1 RETURNING ${PRACTICE_SESSION_COLUMNS}`,
    [sessionId]
  );
  return rows[0];
}

export async function getSessionSummary(sessionId: string): Promise<SessionSummary> {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int as total,
       COUNT(*) FILTER (WHERE result = 'got_it')::int as got_it_count,
       COUNT(*) FILTER (WHERE result = 'missed_it')::int as missed_it_count
     FROM practice_events
     WHERE session_id = $1`,
    [sessionId]
  );
  const { total, got_it_count, missed_it_count } = rows[0];
  return {
    total,
    got_it: got_it_count,
    missed_it: missed_it_count,
    accuracy: total > 0 ? got_it_count / total : null,
  };
}

// Progress shown on deck listing/detail: last-practiced and accuracy come from
// the most recently *completed* session, not a lifetime aggregate, so the
// number reflects "how did I do last time" rather than smoothing over history.
// Sessions completed with zero events are skipped — a drill the user abandoned
// without answering anybody isn't a practice, and letting it win the "latest"
// slot would blank out a real score and re-stamp last_practiced.
//
// Batched over deck ids so a deck listing costs one query rather than one per
// deck; decks with no qualifying session are absent from the result and get the
// { null, null } default seeded below.
export async function getDeckProgressMap(deckIds: string[]): Promise<Map<string, DeckProgress>> {
  const progress = new Map<string, DeckProgress>(
    deckIds.map(id => [id, { last_practiced: null, accuracy: null }])
  );
  if (deckIds.length === 0) return progress;

  const { rows } = await pool.query(
    `SELECT DISTINCT ON (ps.deck_id)
            ps.deck_id,
            ps.completed_at,
            COUNT(pe.*) FILTER (WHERE pe.result = 'got_it')::int as got_it_count,
            COUNT(pe.*)::int as total_count
     FROM practice_sessions ps
     JOIN practice_events pe ON pe.session_id = ps.id
     WHERE ps.deck_id = ANY($1::uuid[]) AND ps.completed_at IS NOT NULL
     GROUP BY ps.deck_id, ps.id, ps.completed_at
     ORDER BY ps.deck_id, ps.completed_at DESC`,
    [deckIds]
  );

  for (const { deck_id, completed_at, got_it_count, total_count } of rows) {
    progress.set(deck_id, {
      last_practiced: completed_at,
      accuracy: total_count > 0 ? got_it_count / total_count : null,
    });
  }

  return progress;
}

export async function getDeckProgress(deckId: string): Promise<DeckProgress> {
  const progress = await getDeckProgressMap([deckId]);
  return progress.get(deckId)!;
}
