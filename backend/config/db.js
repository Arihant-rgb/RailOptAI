import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mockFilePath = path.join(__dirname, '../data/mockData.json');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/railoptai'
});

let isPgConnected = false;

// Test PostgreSQL connection
pool.connect()
  .then(client => {
    isPgConnected = true;
    console.log('Successfully connected to PostgreSQL database');
    client.release();
  })
  .catch(err => {
    isPgConnected = false;
    console.log('PostgreSQL connection not detected. Using mockData.json fallback mode.');
  });

// Read mock data helper
export const readMockData = () => {
  try {
    const raw = fs.readFileSync(mockFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error reading mockData.json:', error);
    return {
      maintenanceJobs: [],
      sections: [],
      stations: [],
      trains: [],
      trainMovements: [],
      blocks: [],
      plannedJobs: [],
      kpis: {}
    };
  }
};

// Write mock data helper
export const writeMockData = (data) => {
  try {
    fs.writeFileSync(mockFilePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing mockData.json:', error);
    return false;
  }
};

export const isPostgresConnected = () => isPgConnected;

export default pool;
