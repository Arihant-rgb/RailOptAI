import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const mockFilePath = path.join(__dirname, '../data/mockData.json');
const dataRoot = path.join(__dirname, '../../data'); // workstation/data/

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
  .catch(() => {
    isPgConnected = false;
    console.log('PostgreSQL not detected — using real CSV/JSON file fallback mode.');
  });

// ─── CSV parser helper ───────────────────────────────────────────────────────
const parseCSV = (filePath) => {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => {
        const val = values[i] ?? '';
        // coerce booleans and numbers
        if (val === 'true') obj[h] = true;
        else if (val === 'false') obj[h] = false;
        else if (val !== '' && !isNaN(Number(val))) obj[h] = Number(val);
        else obj[h] = val;
      });
      return obj;
    });
  } catch (err) {
    console.error(`CSV parse error for ${filePath}:`, err.message);
    return [];
  }
};

const parseJSON = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`JSON parse error for ${filePath}:`, err.message);
    return [];
  }
};

// ─── Real data loader ────────────────────────────────────────────────────────
export const readRealData = () => {
  return {
    stations:           parseCSV(path.join(dataRoot, 'raw/stations.csv')),
    sections:           parseCSV(path.join(dataRoot, 'raw/sections.csv')),
    trains:             parseCSV(path.join(dataRoot, 'processed/trains_unified.csv')),
    trainMovements:     parseCSV(path.join(dataRoot, 'processed/train_movements.csv')),
    maintenanceJobs:    parseJSON(path.join(dataRoot, 'processed/maintenance_jobs_unified.json')),
    blocks:             parseCSV(path.join(dataRoot, 'processed/blocks.csv')),
    plannedJobs:        parseJSON(path.join(dataRoot, 'processed/planned_jobs.json')),
    kpis:               parseJSON(path.join(dataRoot, 'processed/kpis.json')),
    compatibilityRules: parseCSV(path.join(dataRoot, 'synthetic/compatibility_rules.csv')),
    freightDemand:      parseCSV(path.join(dataRoot, 'synthetic/freight_demand.csv')),
  };
};

// ─── Mock data helpers (legacy, kept for write operations) ───────────────────
export const readMockData = () => {
  try {
    const raw = fs.readFileSync(mockFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error reading mockData.json:', error);
    return readRealData(); // graceful fallback to real data
  }
};

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
