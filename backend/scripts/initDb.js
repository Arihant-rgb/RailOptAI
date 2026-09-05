import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDatabase() {
  console.log('Initializing PostgreSQL database...');
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
    const seedSql = fs.readFileSync(path.join(__dirname, '../database/seed.sql'), 'utf8');

    console.log('Executing schema.sql...');
    await pool.query(schemaSql);
    console.log('Schema created successfully.');

    console.log('Executing seed.sql...');
    await pool.query(seedSql);
    console.log('Seed data inserted successfully.');

    console.log('Database initialization completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initDatabase();
