import express from 'express';
import pool, { isPostgresConnected, readRealData } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const plannedJobsPath = path.join(__dirname, '../../data/processed/planned_jobs.json');

// ─── POST /api/planning/generate ─────────────────────────────────────────────
router.post('/generate', async (req, res) => {
  try {
    const { start_date, end_date, sections } = req.body;
    const data = readRealData();

    if (isPostgresConnected()) {
      const plannedRes = await pool.query('SELECT pj.*, mj.priority, mj.department FROM plan_jobs pj JOIN maintenance_jobs mj ON pj.job_id = mj.job_id ORDER BY mj.priority_score DESC');
      return res.json({
        success: true,
        message: 'Optimized block plan generated',
        time_range: { start_date: start_date || '2026-09-05', end_date: end_date || '2026-09-11' },
        plannedJobs: plannedRes.rows,
        kpis: data.kpis
      });
    }

    return res.json({
      success: true,
      message: 'Block plan generated from real dataset',
      time_range: { start_date: start_date || '2026-09-05', end_date: end_date || '2026-09-11' },
      sections: sections || data.sections.map(s => s.section_id),
      plannedJobs: data.plannedJobs,
      kpis: data.kpis
    });
  } catch (error) {
    console.error('Error generating plan:', error);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// ─── GET /api/planning/weekly ─────────────────────────────────────────────────
router.get('/weekly', async (req, res) => {
  try {
    if (isPostgresConnected()) {
      const result = await pool.query(`
        SELECT pj.*, mj.priority, mj.department, mj.section_id, b.start_time, b.end_time, b.date
        FROM plan_jobs pj
        JOIN maintenance_jobs mj ON pj.job_id = mj.job_id
        JOIN blocks b ON pj.block_id = b.block_id
        ORDER BY b.date, b.start_time
      `);
      return res.json({ period: 'Weekly', startDate: '2026-09-05', endDate: '2026-09-11', plannedJobs: result.rows });
    }
    const data = readRealData();
    return res.json({ period: 'Weekly', startDate: '2026-09-05', endDate: '2026-09-11', plannedJobs: data.plannedJobs });
  } catch (error) {
    console.error('Error fetching weekly plan:', error);
    res.status(500).json({ error: 'Failed to fetch weekly plan' });
  }
});

// ─── GET /api/planning/monthly ────────────────────────────────────────────────
router.get('/monthly', async (req, res) => {
  try {
    if (isPostgresConnected()) {
      const result = await pool.query(`
        SELECT pj.*, mj.priority, mj.department, mj.section_id, b.start_time, b.end_time, b.date
        FROM plan_jobs pj
        JOIN maintenance_jobs mj ON pj.job_id = mj.job_id
        JOIN blocks b ON pj.block_id = b.block_id
        ORDER BY b.date, b.start_time
      `);
      return res.json({ period: 'Monthly', startDate: '2026-09-01', endDate: '2026-09-30', plannedJobs: result.rows });
    }
    const data = readRealData();
    return res.json({ period: 'Monthly', startDate: '2026-09-01', endDate: '2026-09-30', plannedJobs: data.plannedJobs });
  } catch (error) {
    console.error('Error fetching monthly plan:', error);
    res.status(500).json({ error: 'Failed to fetch monthly plan' });
  }
});

// ─── GET /api/planning/compatibility ─────────────────────────────────────────
router.get('/compatibility', async (req, res) => {
  try {
    if (isPostgresConnected()) {
      const result = await pool.query('SELECT * FROM compatibility_rules');
      return res.json(result.rows);
    }
    const data = readRealData();
    return res.json(data.compatibilityRules);
  } catch (error) {
    console.error('Error fetching compatibility rules:', error);
    res.status(500).json({ error: 'Failed to fetch compatibility rules' });
  }
});

// ─── GET /api/planning/freight ────────────────────────────────────────────────
router.get('/freight', async (req, res) => {
  try {
    const { section, date } = req.query;
    if (isPostgresConnected()) {
      let query = 'SELECT * FROM freight_demand WHERE 1=1';
      const values = [];
      if (section) { values.push(section); query += ` AND section_id = $${values.length}`; }
      if (date)    { values.push(date);    query += ` AND date = $${values.length}`; }
      const result = await pool.query(query, values);
      return res.json(result.rows);
    }
    const data = readRealData();
    let freight = data.freightDemand;
    if (section) freight = freight.filter(f => f.section_id === section);
    if (date)    freight = freight.filter(f => f.date === date);
    return res.json(freight);
  } catch (error) {
    console.error('Error fetching freight demand:', error);
    res.status(500).json({ error: 'Failed to fetch freight demand' });
  }
});

// ─── POST /api/planning/forward  (Job → best matching blocks) ────────────────
router.post('/forward', async (req, res) => {
  try {
    const { job_id } = req.body;
    const data = readRealData();

    const job = data.maintenanceJobs.find(j => j.job_id === job_id);
    if (!job) return res.status(404).json({ error: `Job ${job_id} not found` });

    // Find available blocks on the same section that are long enough
    const matchingBlocks = data.blocks
      .filter(b => b.section_id === job.section_id && b.status === 'Available' && b.duration_minutes >= job.estimated_duration * 60)
      .map(b => ({
        ...b,
        fit_score: Math.min(100, Math.round(100 - Math.abs(b.duration_minutes - job.estimated_duration * 60) / 10))
      }))
      .sort((a, b) => b.fit_score - a.fit_score)
      .slice(0, 5);

    return res.json({ success: true, job, bestBlocks: matchingBlocks });
  } catch (error) {
    console.error('Error in forward planning:', error);
    res.status(500).json({ error: 'Forward planning failed' });
  }
});

// ─── POST /api/planning/reverse  (Block → best work package) ─────────────────
router.post('/reverse', async (req, res) => {
  try {
    const { block_id } = req.body;
    const data = readRealData();

    const block = data.blocks.find(b => b.block_id === block_id);
    if (!block) return res.status(404).json({ error: `Block ${block_id} not found` });

    // Find pending jobs on the same section that fit within the block duration
    const blockDurationHours = block.duration_minutes / 60;
    const compatibleJobs = data.maintenanceJobs
      .filter(j => j.section_id === block.section_id && j.status === 'Pending' && j.estimated_duration <= blockDurationHours)
      .sort((a, b) => b.priority_score - a.priority_score);

    // Bundle jobs greedily until block is full
    let remainingHours = blockDurationHours;
    const bundled = [];
    for (const job of compatibleJobs) {
      if (job.estimated_duration <= remainingHours) {
        bundled.push(job);
        remainingHours -= job.estimated_duration;
      }
    }

    const departments = [...new Set(bundled.map(j => j.department))];
    return res.json({
      success: true,
      block,
      recommendedWorkPackage: {
        bundled_jobs: bundled,
        total_duration_hours: blockDurationHours - remainingHours,
        block_duration_hours: blockDurationHours,
        bundle_score: bundled.length > 0 ? Math.round(bundled.reduce((s, j) => s + j.priority_score, 0) / bundled.length) : 0,
        cross_department: departments.length > 1,
        departments
      }
    });
  } catch (error) {
    console.error('Error in reverse planning:', error);
    res.status(500).json({ error: 'Reverse planning failed' });
  }
});

// ─── POST /api/planning/replan  (Emergency replanning) ───────────────────────
router.post('/replan', async (req, res) => {
  try {
    const { emergency_job_id, section_id, defect_type, department } = req.body;
    const data = readRealData();

    // Find the first available block on that section
    const availableBlock = data.blocks.find(b => b.section_id === section_id && b.status === 'Available');

    const newEmergencyJob = {
      job_id: emergency_job_id || `EMG_${Date.now()}`,
      block_id: availableBlock?.block_id || 'B001',
      section_id: section_id || 'S01',
      department: department || 'SMMS',
      priority: 'Critical',
      estimated_duration_hours: 1
    };

    if (isPostgresConnected()) {
      await pool.query(
        'INSERT INTO plan_jobs (job_id, block_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [newEmergencyJob.job_id, newEmergencyJob.block_id]
      );
    } else {
      // Append to planned_jobs.json
      let jobs = [];
      try { jobs = JSON.parse(fs.readFileSync(plannedJobsPath, 'utf8')); } catch (_) {}
      jobs.push(newEmergencyJob);
      fs.writeFileSync(plannedJobsPath, JSON.stringify(jobs, null, 2), 'utf8');
    }

    return res.json({
      success: true,
      message: 'Emergency replanning completed',
      added_job: newEmergencyJob,
      assigned_block: availableBlock || null,
      affected_section: section_id
    });
  } catch (error) {
    console.error('Error during replanning:', error);
    res.status(500).json({ error: 'Replanning failed' });
  }
});

export default router;
