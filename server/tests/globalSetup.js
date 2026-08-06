// Runs once, in its own process, before any test file loads. Recreates the
// dedicated test database from scratch and applies every migration, so each
// test run starts from a known-clean schema regardless of what a previous
// run left behind.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { testDatabaseUrl } = require('./testDatabaseUrl');

module.exports = async function globalSetup() {
  const adminUrl = process.env.DATABASE_URL || 'postgres://namedrop:namedrop_dev_password@localhost:5432/namedrop';
  const testUrl = testDatabaseUrl();
  const dbName = new URL(testUrl).pathname.slice(1);

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const testDb = new Client({ connectionString: testUrl });
  await testDb.connect();
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    await testDb.query(sql);
  }
  await testDb.end();
};
