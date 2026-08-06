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

export type DeckDetail = VirtualDeckDetail | PrebuiltDeckDetail;

export async function listDecks(): Promise<DeckSummary[]> {
  const res = await fetch(BASE);
  if (!res.ok) throw await apiError(res, 'Failed to fetch decks');
  return res.json();
}

export async function getDeckDetail(id: string): Promise<DeckDetail> {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw await apiError(res, 'Failed to fetch deck');
  return res.json();
}
