// Derives the dedicated test database URL from DATABASE_URL, e.g.
// postgres://user:pass@host:5432/namedrop -> postgres://user:pass@host:5432/namedrop_test
// Keeps tests off the dev database without needing a separate env var to configure.
function testDatabaseUrl() {
  const base = process.env.DATABASE_URL || 'postgres://namedrop:namedrop_dev_password@localhost:5432/namedrop';
  const url = new URL(base);
  url.pathname = `${url.pathname}_test`;
  return url.toString();
}

module.exports = { testDatabaseUrl };
