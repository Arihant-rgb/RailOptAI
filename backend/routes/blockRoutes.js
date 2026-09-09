import express from 'express';
import pool, { isPostgresConnected, readRealData } from '../config/db.js';

const router = express.Router();

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

export default router;
