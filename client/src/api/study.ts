const BASE = '/api/study';

export interface StudyCard {
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
}

export interface SessionStartResponse {
  session_id?: string;
  card?: StudyCard;
  remaining?: number;
  empty?: boolean;
  next_due?: string | null;
}

export interface ReviewResponse {
  card?: StudyCard | null;
  remaining?: number;
  complete?: boolean;
}

export interface SessionSummary {
  total_reviewed: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export interface StudyStatus {
  due_count: number;
  next_due: string | null;
}

export async function startSession(): Promise<SessionStartResponse> {
  const res = await fetch(`${BASE}/sessions`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to start session');
  return res.json();
}

export async function getNextCard(sessionId: string): Promise<ReviewResponse> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/next`);
  if (!res.ok) throw new Error('Failed to get next card');
  return res.json();
}

export async function submitReview(sessionId: string, contactId: string, rating: string): Promise<ReviewResponse> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contact_id: contactId, rating }),
  });
  if (!res.ok) throw new Error('Failed to submit review');
  return res.json();
}

export async function completeSession(sessionId: string): Promise<SessionSummary> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/complete`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to complete session');
  return res.json();
}

export async function getStudyStatus(): Promise<StudyStatus> {
  const res = await fetch(`${BASE}/status`);
  if (!res.ok) throw new Error('Failed to get study status');
  return res.json();
}
