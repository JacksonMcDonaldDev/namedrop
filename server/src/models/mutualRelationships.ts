import pool from '../db';
import * as contactsModel from './contacts';

interface MutualContact {
  id: string;
  first_name: string;
  last_name: string | null;
  is_placeholder: boolean;
}

export async function getByContactId(contactId: string): Promise<MutualContact[]> {
  const { rows } = await pool.query(
    `SELECT c.id, c.first_name, c.last_name, c.is_placeholder
     FROM mutual_relationships mr
     JOIN contacts c ON c.id = mr.mutual_contact_id
     WHERE mr.contact_id = $1
     ORDER BY c.first_name`,
    [contactId]
  );
  return rows;
}

export async function replaceForContact(
  contactId: string,
  mutuals: Array<{ id?: string; name?: string }>
): Promise<MutualContact[]> {
  // Delete existing relationships
  await pool.query('DELETE FROM mutual_relationships WHERE contact_id = $1', [contactId]);

  const results: MutualContact[] = [];

  for (const mutual of mutuals) {
    let mutualContactId: string;

    if (mutual.id) {
      // Link to existing contact
      const existing = await contactsModel.getById(mutual.id);
      if (!existing) continue;
      mutualContactId = existing.id;
    } else if (mutual.name) {
      // Find or create placeholder
      const nameParts = mutual.name.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

      // Look for existing contact/placeholder with this name
      const matches = await contactsModel.searchByName(mutual.name);
      const exactMatch = matches.find(m =>
        m.first_name.toLowerCase() === firstName.toLowerCase() &&
        (m.last_name?.toLowerCase() || '') === (lastName?.toLowerCase() || '')
      );

      if (exactMatch) {
        mutualContactId = exactMatch.id;
      } else {
        // Create placeholder
        const placeholder = await contactsModel.create({
          first_name: firstName,
          last_name: lastName,
          is_placeholder: true,
        });
        mutualContactId = placeholder.id;
      }
    } else {
      continue;
    }

    // Skip self-references
    if (mutualContactId === contactId) continue;

    // Insert relationship (ignore duplicates)
    try {
      await pool.query(
        'INSERT INTO mutual_relationships (contact_id, mutual_contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [contactId, mutualContactId]
      );
    } catch {
      continue;
    }

    const contact = await contactsModel.getById(mutualContactId);
    if (contact) {
      results.push({
        id: contact.id,
        first_name: contact.first_name,
        last_name: contact.last_name,
        is_placeholder: contact.is_placeholder,
      });
    }
  }

  return results;
}
