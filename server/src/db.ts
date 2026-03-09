import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://namedrop:namedrop_dev_password@localhost:5432/namedrop',
});

export default pool;
