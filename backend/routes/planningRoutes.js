import express from 'express';
import pool, { isPostgresConnected, readMockData, writeMockData } from '../config/db.js';

const router = express.Router();

// POST /api/planning/generate
router.post('/generate', async (req, res) => {
  try {
    const { start_date, end_date, sections } = req.body;

    if (isPostgresConnected()) {
      const plannedRes = await pool.query('SELECT * FROM planned_jobs ORDER BY start_time ASC');
      const kpisRes = await pool.query('SELECT * FROM kpis ORDER BY id DESC LIMIT 1');

      return res.json({
        success: true,
        message: 'Optimized block plan generated successfully',
        time_range: { start_date: start_date || '2026-09-05', end_date: end_date || '2026-09-11' },
        sections: sections || ['S01', 'S02', 'S03'],
        plannedJobs: plannedRes.rows,
        kpis: kpisRes.rows[0] || {}
      });
    } else {
      const mock = readMockData();
      return res.json({
        success: true,
        message: 'Optimized block plan generated successfully (mock optimizer mode)',
        time_range: { start_date: start_date || '2026-09-05', end_date: end_date || '2026-09-11' },
        sections: sections || ['S01', 'S02', 'S03'],
        plannedJobs: mock.plannedJobs || [],
        kpis: mock.kpis || {}
      });
    }
  } catch (error) {
    console.error('Error generating plan:', error);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// GET /api/planning/weekly
router.get('/weekly', async (req, res) => {
  try {
    if (isPostgresConnected()) {
      const plannedRes = await pool.query('SELECT * FROM planned_jobs ORDER BY start_time ASC');
      return res.json({
        period: 'Weekly',
        startDate: '2026-09-05',
        endDate: '2026-09-11',
        plannedJobs: plannedRes.rows
      });
    } else {
      const mock = readMockData();
      return res.json({
        period: 'Weekly',
        startDate: '2026-09-05',
        endDate: '2026-09-11',
        plannedJobs: mock.plannedJobs || []
      });
    }
  } catch (error) {
    console.error('Error fetching weekly plan:', error);
    res.status(500).json({ error: 'Failed to fetch weekly plan' });
  }
});

// GET /api/planning/monthly
router.get('/monthly', async (req, res) => {
  try {
    if (isPostgresConnected()) {
      const plannedRes = await pool.query('SELECT * FROM planned_jobs ORDER BY start_time ASC');
      return res.json({
        period: 'Monthly',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        plannedJobs: plannedRes.rows
      });
    } else {
      const mock = readMockData();
      return res.json({
        period: 'Monthly',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        plannedJobs: mock.plannedJobs || []
      });
    }
  } catch (error) {
    console.error('Error fetching monthly plan:', error);
    res.status(500).json({ error: 'Failed to fetch monthly plan' });
  }
});

// POST /api/replanning (Dynamic Emergency Replanning)
router.post('/replan', async (req, res) => {
  try {
    const { emergency_job_id, section_id, defect_type, department } = req.body;

    const newEmergencyJob = {
      job_id: emergency_job_id || `EMG_${Date.now()}`,
      block_id: 'B001',
      section_id: section_id || 'S01',
      start_time: '02:00',
      end_time: '04:00',
      priority: 'Critical',
      department: department || 'SMMS'
    };

    if (isPostgresConnected()) {
      await pool.query(
        'INSERT INTO planned_jobs (job_id, block_id, section_id, start_time, end_time, priority, department) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [newEmergencyJob.job_id, newEmergencyJob.block_id, newEmergencyJob.section_id, newEmergencyJob.start_time, newEmergencyJob.end_time, newEmergencyJob.priority, newEmergencyJob.department]
      );
    } else {
      const mock = readMockData();
      mock.plannedJobs.push(newEmergencyJob);
      writeMockData(mock);
    }

    return res.json({
      success: true,
      message: 'Emergency replanning completed successfully',
      added_job: newEmergencyJob,
      affected_section: section_id || 'S01'
    });
  } catch (error) {
    console.error('Error during replanning:', error);
    res.status(500).json({ error: 'Failed to perform replanning' });
  }
});

export default router;
