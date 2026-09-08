import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required.');
}

const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const database = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await database.connect();
  await database.query(schema);
  console.log('Database schema is ready.');
} finally {
  await database.end();
}
