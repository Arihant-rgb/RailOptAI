import express from 'express';
import pool, { isPostgresConnected, readRealData } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GET /api/blocks
// Query params: section, date, status
router.get('/', async (req, res) => {
  try {
    const { section, date, status } = req.query;

    if (isPostgresConnected()) {
      let query = 'SELECT * FROM blocks WHERE 1=1';
      const values = [];
      if (section) { values.push(section); query += ` AND section_id = $${values.length}`; }
      if (date)    { values.push(date);    query += ` AND date = $${values.length}`; }
      if (status)  { values.push(status);  query += ` AND status = $${values.length}`; }
      query += ' ORDER BY section_id, start_time ASC';
      const result = await pool.query(query, values);
      return res.json(result.rows);
    }

    const data = readRealData();
    let blocks = data.blocks;
    if (section) blocks = blocks.filter(b => String(b.section_id).toLowerCase() === section.toLowerCase());
    if (date)    blocks = blocks.filter(b => b.date === date);
    if (status)  blocks = blocks.filter(b => String(b.status).toLowerCase() === status.toLowerCase());
    return res.json(blocks);
  } catch (error) {
    console.error('Error fetching blocks:', error);
    res.status(500).json({ error: 'Failed to fetch blocks' });
  }
});

// ─── POST /api/blocks/assign  (Book/Occupy a block with a maintenance job) ────
router.post('/assign', async (req, res) => {
  try {
    const { block_id, job_id, status = 'Occupied', notes } = req.body;
    if (!block_id) {
      return res.status(400).json({ error: 'block_id is required' });
    }

    const dataRoot = path.join(__dirname, '../../data/processed');
    const blocksPath = path.join(dataRoot, 'blocks.csv');
    const jobsPath = path.join(dataRoot, 'maintenance_jobs_unified.json');

    // 1. Update blocks.csv
    let blockText = fs.readFileSync(blocksPath, 'utf8');
    let lines = blockText.trim().split(/\r?\n/);
    if (lines.length < 2) return res.status(500).json({ error: 'Invalid blocks data' });

    const header = lines[0];
    let updatedBlock = null;
    const newLines = [header];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(s => s.trim());
      if (parts[0] === block_id) {
        parts[6] = status; // update status column
        updatedBlock = {
          block_id: parts[0],
          section_id: parts[1],
          date: parts[2],
          start_time: parts[3],
          end_time: parts[4],
          duration_minutes: Number(parts[5]),
          status: parts[6]
        };
        newLines.push(parts.join(','));
      } else {
        newLines.push(lines[i]);
      }
    }

    if (!updatedBlock) {
      return res.status(404).json({ error: `Block ${block_id} not found` });
    }

    fs.writeFileSync(blocksPath, newLines.join('\n') + '\n', 'utf8');

    // 2. If job_id provided, update maintenance_jobs_unified.json status -> 'Scheduled'
    let updatedJob = null;
    if (job_id && fs.existsSync(jobsPath)) {
      try {
        const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
        const jIdx = jobs.findIndex(j => j.job_id === job_id);
        if (jIdx !== -1) {
          jobs[jIdx].status = 'Scheduled';
          jobs[jIdx].block_id = block_id;
          jobs[jIdx].scheduled_date = updatedBlock.date;
          jobs[jIdx].scheduled_window = `${updatedBlock.start_time}-${updatedBlock.end_time}`;
          updatedJob = jobs[jIdx];
          fs.writeFileSync(jobsPath, JSON.stringify(jobs, null, 2), 'utf8');
        }
      } catch (jErr) {
        console.warn('Could not sync job status:', jErr.message);
      }
    }

    return res.json({
      success: true,
      message: `Block ${block_id} successfully marked as ${status}`,
      block: updatedBlock,
      assigned_job: updatedJob
    });
  } catch (error) {
    console.error('Error assigning block:', error);
    res.status(500).json({ error: 'Failed to assign block' });
  }
});

// ─── PATCH /api/blocks/:block_id/status  (Quick status toggle) ────────────────
router.patch('/:block_id/status', async (req, res) => {
  try {
    const { block_id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });

    const blocksPath = path.join(__dirname, '../../data/processed/blocks.csv');
    let blockText = fs.readFileSync(blocksPath, 'utf8');
    let lines = blockText.trim().split(/\r?\n/);
    const header = lines[0];
    let found = false;
    const newLines = [header];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(s => s.trim());
      if (parts[0] === block_id) {
        parts[6] = status;
        newLines.push(parts.join(','));
        found = true;
      } else {
        newLines.push(lines[i]);
      }
    }

    if (!found) return res.status(404).json({ error: `Block ${block_id} not found` });

    fs.writeFileSync(blocksPath, newLines.join('\n') + '\n', 'utf8');
    return res.json({ success: true, block_id, status });
  } catch (error) {
    console.error('Error updating block status:', error);
    res.status(500).json({ error: 'Failed to update block status' });
  }
});

export default router;

