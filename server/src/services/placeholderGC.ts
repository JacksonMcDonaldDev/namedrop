import pool from '../db';

export async function collectOrphans(): Promise<number> {
  const { rowCount } = await pool.query(`
    DELETE FROM contacts
    WHERE is_placeholder = true
      AND id NOT IN (
        SELECT DISTINCT mutual_contact_id FROM mutual_relationships
      )
  `);
  const deleted = rowCount ?? 0;
  if (deleted > 0) {
    console.log(`Garbage collected ${deleted} orphaned placeholder(s)`);
  }
  return deleted;
}
