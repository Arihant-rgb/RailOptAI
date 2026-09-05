import express from 'express';
import pool, { isPostgresConnected, readMockData } from '../config/db.js';

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

    const mock = readMockData();
    return res.json(mock.kpis || {
      total_jobs: 30,
      critical_jobs: 8,
      scheduled_jobs: 22,
      available_blocks: 15,
      schedule_conflicts: 0,
      block_utilization: 78,
      cross_department_bundles: 4
    });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

export default router;
