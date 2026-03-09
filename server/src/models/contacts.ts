import pool from '../db';

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
  created_at: Date;
  updated_at: Date;
}

export interface CreateContactData {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  relationship?: string;
  where_met?: string;
  photo_path?: string;
  mnemonic?: string;
  notes?: string;
  is_placeholder?: boolean;
}

const CONTACT_COLUMNS = `id, is_placeholder, first_name, last_name, email, phone, company, relationship, where_met, photo_path, mnemonic, notes, created_at, updated_at`;

export async function list(search?: string): Promise<Contact[]> {
  let query = `SELECT ${CONTACT_COLUMNS} FROM contacts WHERE is_placeholder = false`;
  const params: string[] = [];

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query += ` AND (first_name ILIKE $1 OR last_name ILIKE $1 OR company ILIKE $1 OR where_met ILIKE $1)`;
    params.push(term);
  }

  query += ` ORDER BY created_at DESC`;
  const { rows } = await pool.query(query, params);
  return rows;
}

export async function getById(id: string): Promise<Contact | null> {
  const { rows } = await pool.query(`SELECT ${CONTACT_COLUMNS} FROM contacts WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function create(data: CreateContactData): Promise<Contact> {
  const fields = ['first_name'];
  const values: any[] = [data.first_name];
  let idx = 2;

  const optionalFields = ['last_name', 'email', 'phone', 'company', 'relationship', 'where_met', 'photo_path', 'mnemonic', 'notes', 'is_placeholder'] as const;
  for (const field of optionalFields) {
    if (data[field] !== undefined) {
      fields.push(field);
      values.push(data[field]);
      idx++;
    }
  }

  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await pool.query(
    `INSERT INTO contacts (${fields.join(', ')}) VALUES (${placeholders}) RETURNING ${CONTACT_COLUMNS}`,
    values
  );
  return rows[0];
}

export async function update(id: string, data: Partial<CreateContactData>): Promise<Contact | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  const updatableFields = ['first_name', 'last_name', 'email', 'phone', 'company', 'relationship', 'where_met', 'photo_path', 'mnemonic', 'notes', 'is_placeholder'] as const;
  for (const field of updatableFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = $${idx}`);
      values.push(data[field]);
      idx++;
    }
  }

  if (fields.length === 0) return getById(id);

  fields.push(`updated_at = now()`);
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE contacts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING ${CONTACT_COLUMNS}`,
    values
  );
  return rows[0] || null;
}

export async function remove(id: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM contacts WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

export async function searchByName(name: string): Promise<Contact[]> {
  const term = `%${name.trim()}%`;
  const { rows } = await pool.query(
    `SELECT ${CONTACT_COLUMNS} FROM contacts WHERE (first_name ILIKE $1 OR last_name ILIKE $1) ORDER BY is_placeholder ASC, first_name ASC`,
    [term]
  );
  return rows;
}
