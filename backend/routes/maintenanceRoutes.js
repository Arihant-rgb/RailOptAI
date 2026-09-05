import express from 'express';
import pool, { isPostgresConnected, readMockData, writeMockData } from '../config/db.js';

const router = express.Router();

// GET /api/maintenance
// Supports query filters: department, section, priority, status
router.get('/', async (req, res) => {
  try {
    const { department, section, priority, status } = req.query;

    if (isPostgresConnected()) {
      let query = 'SELECT * FROM maintenance_jobs WHERE 1=1';
      const values = [];

      if (department) {
        values.push(department);
        query += ` AND department = $${values.length}`;
      }
      if (section) {
        values.push(section);
        query += ` AND section_id = $${values.length}`;
      }
      if (priority) {
        values.push(priority);
        query += ` AND priority = $${values.length}`;
      }
      if (status) {
        values.push(status);
        query += ` AND status = $${values.length}`;
      }

      query += ' ORDER BY priority_score DESC';
      const result = await pool.query(query, values);
      return res.json(result.rows);
    } else {
      const mock = readMockData();
      let jobs = mock.maintenanceJobs || [];

      if (department) {
        jobs = jobs.filter(j => j.department.toLowerCase() === department.toLowerCase());
      }
      if (section) {
        jobs = jobs.filter(j => j.section_id.toLowerCase() === section.toLowerCase());
      }
      if (priority) {
        jobs = jobs.filter(j => j.priority.toLowerCase() === priority.toLowerCase());
      }
      if (status) {
        jobs = jobs.filter(j => j.status.toLowerCase() === status.toLowerCase());
      }

      return res.json(jobs);
    }
  } catch (error) {
    console.error('Error fetching maintenance jobs:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance jobs' });
  }
});

// GET /api/maintenance/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (isPostgresConnected()) {
      const result = await pool.query('SELECT * FROM maintenance_jobs WHERE job_id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found' });
      }
      return res.json(result.rows[0]);
    } else {
      const mock = readMockData();
      const job = (mock.maintenanceJobs || []).find(j => j.job_id === id);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      return res.json(job);
    }
  } catch (error) {
    console.error('Error fetching job details:', error);
    res.status(500).json({ error: 'Failed to fetch job details' });
  }
});

// POST /api/maintenance (Add/Update Job)
router.post('/', async (req, res) => {
  try {
    const newJob = req.body;
    if (!newJob.job_id || !newJob.department || !newJob.section_id) {
      return res.status(400).json({ error: 'Missing required fields: job_id, department, section_id' });
    }

    if (isPostgresConnected()) {
      const query = `
        INSERT INTO maintenance_jobs (
          job_id, department, section_id, asset_id, asset_type, defect_type,
          maintenance_type, severity, overdue_days, estimated_duration,
          power_block_required, asset_impact, delay_risk, priority_score, priority, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (job_id) DO UPDATE SET
          department = EXCLUDED.department,
          section_id = EXCLUDED.section_id,
          asset_id = EXCLUDED.asset_id,
          asset_type = EXCLUDED.asset_type,
          defect_type = EXCLUDED.defect_type,
          maintenance_type = EXCLUDED.maintenance_type,
          severity = EXCLUDED.severity,
          overdue_days = EXCLUDED.overdue_days,
          estimated_duration = EXCLUDED.estimated_duration,
          power_block_required = EXCLUDED.power_block_required,
          asset_impact = EXCLUDED.asset_impact,
          delay_risk = EXCLUDED.delay_risk,
          priority_score = EXCLUDED.priority_score,
          priority = EXCLUDED.priority,
          status = EXCLUDED.status
        RETURNING *;
      `;
      const values = [
        newJob.job_id, newJob.department, newJob.section_id, newJob.asset_id,
        newJob.asset_type, newJob.defect_type, newJob.maintenance_type || 'Corrective',
        newJob.severity || 1, newJob.overdue_days || 0, newJob.estimated_duration || 1,
        newJob.power_block_required || false, newJob.asset_impact || 50,
        newJob.delay_risk || 50, newJob.priority_score || 50,
        newJob.priority || 'Medium', newJob.status || 'Pending'
      ];
      const result = await pool.query(query, values);
      return res.status(201).json(result.rows[0]);
    } else {
      const mock = readMockData();
      const existingIdx = mock.maintenanceJobs.findIndex(j => j.job_id === newJob.job_id);
      if (existingIdx >= 0) {
        mock.maintenanceJobs[existingIdx] = { ...mock.maintenanceJobs[existingIdx], ...newJob };
      } else {
        mock.maintenanceJobs.push(newJob);
      }
      writeMockData(mock);
      return res.status(201).json(newJob);
    }
  } catch (error) {
    console.error('Error saving maintenance job:', error);
    res.status(500).json({ error: 'Failed to save maintenance job' });
  }
});

export default router;
