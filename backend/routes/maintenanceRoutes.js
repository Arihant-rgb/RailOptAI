import express from 'express';
import pool, { isPostgresConnected, readRealData, writeMockData } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jobsFilePath = path.join(__dirname, '../../data/processed/maintenance_jobs_unified.json');

// ─── GET /api/maintenance ────────────────────────────────────────────────────
// Query filters: department, section, priority, status
router.get('/', async (req, res) => {
  try {
    const { department, section, priority, status } = req.query;

    if (isPostgresConnected()) {
      let query = 'SELECT * FROM maintenance_jobs WHERE 1=1';
      const values = [];
      if (department) { values.push(department); query += ` AND department = $${values.length}`; }
      if (section)    { values.push(section);    query += ` AND section_id = $${values.length}`; }
      if (priority)   { values.push(priority);   query += ` AND priority = $${values.length}`; }
      if (status)     { values.push(status);     query += ` AND status = $${values.length}`; }
      query += ' ORDER BY priority_score DESC';
      const result = await pool.query(query, values);
      return res.json(result.rows);
    }

    const data = readRealData();
    let jobs = data.maintenanceJobs;
    if (department) jobs = jobs.filter(j => j.department?.toLowerCase() === department.toLowerCase());
    if (section)    jobs = jobs.filter(j => j.section_id?.toLowerCase() === section.toLowerCase());
    if (priority)   jobs = jobs.filter(j => j.priority?.toLowerCase() === priority.toLowerCase());
    if (status)     jobs = jobs.filter(j => j.status?.toLowerCase() === status.toLowerCase());
    return res.json(jobs);
  } catch (error) {
    console.error('Error fetching maintenance jobs:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance jobs' });
  }
});

// ─── GET /api/maintenance/:id ────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (isPostgresConnected()) {
      const result = await pool.query('SELECT * FROM maintenance_jobs WHERE job_id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
      return res.json(result.rows[0]);
    }
    const data = readRealData();
    const job = data.maintenanceJobs.find(j => j.job_id === id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json(job);
  } catch (error) {
    console.error('Error fetching job details:', error);
    res.status(500).json({ error: 'Failed to fetch job details' });
  }
});

// ─── POST /api/maintenance ───────────────────────────────────────────────────
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
          status = EXCLUDED.status,
          priority_score = EXCLUDED.priority_score,
          priority = EXCLUDED.priority
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
    }

    // File-based write: update maintenance_jobs_unified.json
    let jobs = [];
    try { jobs = JSON.parse(fs.readFileSync(jobsFilePath, 'utf8')); } catch (_) {}
    const idx = jobs.findIndex(j => j.job_id === newJob.job_id);
    if (idx >= 0) jobs[idx] = { ...jobs[idx], ...newJob };
    else jobs.push(newJob);
    fs.writeFileSync(jobsFilePath, JSON.stringify(jobs, null, 2), 'utf8');
    return res.status(201).json(newJob);
  } catch (error) {
    console.error('Error saving maintenance job:', error);
    res.status(500).json({ error: 'Failed to save maintenance job' });
  }
});

export default router;
