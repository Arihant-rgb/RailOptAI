import express from 'express';
import pool, { isPostgresConnected, readRealData } from '../config/db.js';

const router = express.Router();

// GET /api/kpis
router.get('/', async (req, res) => {
  try {
    if (isPostgresConnected()) {
      const result = await pool.query('SELECT * FROM kpis ORDER BY id DESC LIMIT 1');
      if (result.rows.length > 0) {
        const { id, updated_at, ...kpiData } = result.rows[0];
        return res.json(kpiData);
      }
    }
    const data = readRealData();
    return res.json(data.kpis);
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

export default router;
