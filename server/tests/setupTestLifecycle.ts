import pool from '../src/db';

// Truncate everything before each test so behavior tests never depend on
// leftover rows from a previous test — new tables added by later tickets are
// picked up automatically, no list to maintain here.
beforeEach(async () => {
  const { rows } = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'migrations'`
  );
  if (rows.length > 0) {
    const tables = rows.map((r: { tablename: string }) => `"${r.tablename}"`).join(', ');
    await pool.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
  }
});

afterAll(async () => {
  await pool.end();
});
