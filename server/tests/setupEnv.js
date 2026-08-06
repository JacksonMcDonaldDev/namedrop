// Runs before the test framework and any test file in each worker process, so it
// must repoint DATABASE_URL to the test database before `../src/db` gets imported
// (that module opens its connection pool as soon as it is required).
const { testDatabaseUrl } = require('./testDatabaseUrl');

process.env.DATABASE_URL = testDatabaseUrl();
