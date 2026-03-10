const BASE = '/api/contacts';

export interface Contact {
  id: string;
  is_placeholder: boolean;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  relationship: string | null;
  where_met: string | null;
  photo_path: string | null;
  mnemonic: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  mutuals?: MutualContact[];
}

export interface MutualContact {
  id: string;
  first_name: string;
  last_name: string | null;
  is_placeholder: boolean;
}

export async function listContacts(search?: string): Promise<Contact[]> {
  const url = search ? `${BASE}?search=${encodeURIComponent(search)}` : BASE;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch contacts');
  return res.json();
}

export async function getContact(id: string): Promise<Contact> {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error('Failed to fetch contact');
  return res.json();
}

export async function createContact(data: FormData): Promise<Contact> {
  const res = await fetch(BASE, { method: 'POST', body: data });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create contact');
  }
  return res.json();
}

export async function updateContact(id: string, data: FormData): Promise<Contact> {
  const res = await fetch(`${BASE}/${id}`, { method: 'PUT', body: data });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update contact');
  }
  return res.json();
}

export async function deleteContact(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete contact');
}

export async function getMutuals(id: string): Promise<MutualContact[]> {
  const res = await fetch(`${BASE}/${id}/mutuals`);
  if (!res.ok) throw new Error('Failed to fetch mutuals');
  return res.json();
}

export async function updateMutuals(id: string, mutuals: Array<{ id?: string; name?: string }>): Promise<MutualContact[]> {
  const res = await fetch(`${BASE}/${id}/mutuals`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mutuals }),
  });
  if (!res.ok) throw new Error('Failed to update mutuals');
  return res.json();
}

export async function searchContacts(query: string): Promise<Contact[]> {
  return listContacts(query);
}

export interface LinkedInScrapedData {
  first_name: string;
  last_name: string;
  company: string | null;
  headline: string | null;
  photo_base64: string | null;
}

export async function scrapeLinkedIn(url: string): Promise<LinkedInScrapedData> {
  const res = await fetch('/api/linkedin/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to scrape LinkedIn profile');
  }
  return res.json();
}
