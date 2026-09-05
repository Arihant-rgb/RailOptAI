import express from 'express';
import pool, { isPostgresConnected, readMockData } from '../config/db.js';

const router = express.Router();

// Helper to fetch stations
const getStationsHandler = async (req, res) => {
  try {
    if (isPostgresConnected()) {
      const result = await pool.query('SELECT * FROM stations ORDER BY station_id');
      return res.json(result.rows);
    } else {
      const mock = readMockData();
      return res.json(mock.stations || []);
    }
  } catch (error) {
    console.error('Error fetching stations:', error);
    res.status(500).json({ error: 'Failed to fetch stations' });
  }
};

// Helper to fetch sections
const getSectionsHandler = async (req, res) => {
  try {
    if (isPostgresConnected()) {
      const result = await pool.query('SELECT * FROM sections ORDER BY section_id');
      return res.json(result.rows);
    } else {
      const mock = readMockData();
      return res.json(mock.sections || []);
    }
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
};

export const stationsRouter = express.Router();
stationsRouter.get('/', getStationsHandler);

export const sectionsRouter = express.Router();
sectionsRouter.get('/', getSectionsHandler);

router.get('/stations', getStationsHandler);
router.get('/sections', getSectionsHandler);

export default router;

