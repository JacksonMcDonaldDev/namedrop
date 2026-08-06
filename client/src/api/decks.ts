import { apiError } from './fetch';

const BASE = '/api/decks';

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

export type DeckSummary = VirtualDeckSummary | PrebuiltDeckSummary;

export async function listDecks(): Promise<DeckSummary[]> {
  const res = await fetch(BASE);
  if (!res.ok) throw await apiError(res, 'Failed to fetch decks');
  return res.json();
}
