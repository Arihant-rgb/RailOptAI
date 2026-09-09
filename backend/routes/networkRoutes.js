import express from 'express';
import pool, { isPostgresConnected, readRealData } from '../config/db.js';

const router = express.Router();

// ─── Helper: fetch stations ──────────────────────────────────────────────────
const getStationsHandler = async (req, res) => {
  try {
    if (isPostgresConnected()) {
      const result = await pool.query('SELECT * FROM stations ORDER BY station_id');
      return res.json(result.rows);
    }
    const data = readRealData();
    return res.json(data.stations);
  } catch (error) {
    console.error('Error fetching stations:', error);
    res.status(500).json({ error: 'Failed to fetch stations' });
  }
};

// ─── Helper: fetch sections ──────────────────────────────────────────────────
const getSectionsHandler = async (req, res) => {
  try {
    if (isPostgresConnected()) {
      const result = await pool.query('SELECT * FROM sections ORDER BY section_id');
      return res.json(result.rows);
    }
    const data = readRealData();
    return res.json(data.sections);
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
};

// Named sub-routers for /api/stations and /api/sections direct paths
export const stationsRouter = express.Router();
stationsRouter.get('/', getStationsHandler);

export const sectionsRouter = express.Router();
sectionsRouter.get('/', getSectionsHandler);

// /api/network/stations and /api/network/sections
router.get('/stations', getStationsHandler);
router.get('/sections', getSectionsHandler);

export default router;
