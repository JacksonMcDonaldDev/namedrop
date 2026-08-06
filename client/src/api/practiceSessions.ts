import { apiError } from './fetch';

const sessionsBase = (deckId: string) => `/api/decks/${deckId}/practice-sessions`;

export interface PracticeSession {
  id: string;
  deck_id: string;
  started_at: string;
  completed_at: string | null;
}

export type DrillResult = 'got_it' | 'missed_it';

export interface PracticeEvent {
  id: string;
  session_id: string;
  deck_person_id: string;
  result: DrillResult;
  created_at: string;
}

export interface DrillSummary {
  total: number;
  got_it: number;
  missed_it: number;
  accuracy: number | null;
}

export async function startDrillSession(deckId: string): Promise<PracticeSession> {
  const res = await fetch(sessionsBase(deckId), { method: 'POST' });
  if (!res.ok) throw await apiError(res, 'Failed to start drill session');
  return res.json();
}

export async function submitDrillEvent(
  deckId: string,
  sessionId: string,
  deckPersonId: string,
  result: DrillResult
): Promise<PracticeEvent> {
  const res = await fetch(`${sessionsBase(deckId)}/${sessionId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deck_person_id: deckPersonId, result }),
  });
  if (!res.ok) throw await apiError(res, 'Failed to submit drill event');
  return res.json();
}

export async function completeDrillSession(deckId: string, sessionId: string): Promise<DrillSummary> {
  const res = await fetch(`${sessionsBase(deckId)}/${sessionId}/complete`, { method: 'POST' });
  if (!res.ok) throw await apiError(res, 'Failed to complete drill session');
  return res.json();
}
