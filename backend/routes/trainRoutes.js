import express from 'express';
import pool, { isPostgresConnected, readMockData } from '../config/db.js';

const router = express.Router();

// GET /api/trains
router.get('/', async (req, res) => {
  try {
    if (isPostgresConnected()) {
      const result = await pool.query('SELECT * FROM trains ORDER BY train_id');
      return res.json(result.rows);
    } else {
      const mock = readMockData();
      return res.json(mock.trains || []);
    }
  } catch (error) {
    console.error('Error fetching trains:', error);
    res.status(500).json({ error: 'Failed to fetch trains' });
  }
});

// GET /api/trains/movements
// Query params: date, section
router.get('/movements', async (req, res) => {
  try {
    const { date, section } = req.query;

    if (isPostgresConnected()) {
      let query = 'SELECT * FROM train_movements WHERE 1=1';
      const values = [];

      if (date) {
        values.push(date);
        query += ` AND date = $${values.length}`;
      }
      if (section) {
        values.push(section);
        query += ` AND section_id = $${values.length}`;
      }

      query += ' ORDER BY arrival_time ASC';
      const result = await pool.query(query, values);
      return res.json(result.rows);
    } else {
      const mock = readMockData();
      let movements = mock.trainMovements || [];

      if (date) {
        movements = movements.filter(m => m.date === date);
      }
      if (section) {
        movements = movements.filter(m => m.section_id.toLowerCase() === section.toLowerCase());
      }

      return res.json(movements);
    }
  } catch (error) {
    console.error('Error fetching train movements:', error);
    res.status(500).json({ error: 'Failed to fetch train movements' });
  }
});

export default router;
