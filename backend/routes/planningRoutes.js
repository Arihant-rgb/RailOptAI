import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { isPostgresConnected, readRealData } from '../config/db.js';
import { runOptimizer } from '../services/optimizerService.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const demoReplanPath = path.join(__dirname, '../../data/processed/demo_replan_s01.json');

function toMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function jobDurationMinutes(job) {
  const hours = Number(job.estimated_duration ?? job.estimated_duration_hours ?? 1);
  return Math.round(hours * 60);
}

function trainsInWindow(movements, sectionId, startMin, endMin) {
  return (movements || []).filter((t) => {
    if (t.section_id !== sectionId) return false;
    const arr = toMinutes(t.arrival_time);
    const dep = toMinutes(t.departure_time) || arr + 5;
    return arr < endMin && dep > startMin;
  });
}

function loadDemoCache() {
  try {
    return JSON.parse(fs.readFileSync(demoReplanPath, 'utf8'));
  } catch {
    return null;
  }
}

function annotateSchedule(blocks, sectionId) {
  return (blocks || []).map((b) => ({
    ...b,
    section_id: b.section_id || sectionId || b.block_id,
    start_time: b.start_time,
    end_time: b.end_time,
    disruption_cost: b.disruption_cost || 0
  }));
}

function diffSchedules(beforeBlocks, afterBlocks) {
  const beforeMap = Object.fromEntries((beforeBlocks || []).map((b) => [b.job_id, b]));
  const moved = [];
  for (const after of afterBlocks || []) {
    const prev = beforeMap[after.job_id];
    if (prev && (prev.start_time !== after.start_time || prev.end_time !== after.end_time)) {
      moved.push({
        job_id: after.job_id,
        from: `${prev.start_time}–${prev.end_time}`,
        to: `${after.start_time}–${after.end_time}`
      });
    }
  }
  return moved;
}

function optimizerLooksUsable(optResult) {
  return optResult && optResult.status !== 'FALLBACK' && optResult.feasible !== false && Array.isArray(optResult.blocks);
}

// ─── GET /api/planning/catalog  (dropdowns for demo) ─────────────────────────
router.get('/catalog', async (req, res) => {
  try {
    const data = readRealData();
    const jobs = (data.maintenanceJobs || [])
      .filter((j) => j.job_id && !String(j.job_id).startsWith('SMM'))
      .slice(0, 40)
      .map((j) => ({
        job_id: j.job_id,
        department: j.department,
        section_id: j.section_id,
        defect_type: j.defect_type,
        priority: j.priority,
        estimated_duration: j.estimated_duration,
        status: j.status,
        priority_score: j.priority_score
      }));

    const blocks = (data.blocks || []).map((b) => ({
      block_id: b.block_id,
      section_id: b.section_id,
      date: b.date,
      start_time: b.start_time,
      end_time: b.end_time,
      duration_minutes: b.duration_minutes,
      status: b.status
    }));

    const sections = [...new Set(blocks.map((b) => b.section_id))].sort();

    return res.json({
      jobs,
      blocks,
      sections,
      demoDefaults: {
        job_id: 'TMS001',
        block_id: 'B026',
        section_id: 'S01',
        defect_type: 'Critical Signal Failure'
      }
    });
  } catch (error) {
    console.error('Error loading planning catalog:', error);
    res.status(500).json({ error: 'Failed to load planning catalog' });
  }
});

// ─── POST /api/planning/generate ─────────────────────────────────────────────
router.post('/generate', async (req, res) => {
  try {
    const { start_date, end_date, sections } = req.body;
    const data = readRealData();

    if (isPostgresConnected()) {
      const plannedRes = await pool.query('SELECT pj.*, mj.priority, mj.department FROM plan_jobs pj JOIN maintenance_jobs mj ON pj.job_id = mj.job_id ORDER BY mj.priority_score DESC');
      return res.json({
        success: true,
        solver: 'dataset',
        message: 'Weekly plan loaded from assigned jobs. Live CP-SAT runs on Emergency Replanning.',
        time_range: { start_date: start_date || '2026-09-05', end_date: end_date || '2026-09-11' },
        plannedJobs: plannedRes.rows,
        kpis: data.kpis
      });
    }

    return res.json({
      success: true,
      solver: 'dataset',
      message: 'Weekly plan loaded from processed assignments (planned_jobs.json). Live CP-SAT runs on Emergency Replanning.',
      time_range: { start_date: start_date || '2026-09-05', end_date: end_date || '2026-09-11' },
      sections: sections || data.sections.map((s) => s.section_id),
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
    if (section) freight = freight.filter((f) => f.section_id === section);
    if (date)    freight = freight.filter((f) => f.date === date);
    return res.json(freight);
  } catch (error) {
    console.error('Error fetching freight demand:', error);
    res.status(500).json({ error: 'Failed to fetch freight demand' });
  }
});

// ─── POST /api/planning/forward  (Job → matching blocks with reasons) ────────
router.post('/forward', async (req, res) => {
  try {
    const { job_id } = req.body;
    const data = readRealData();

    const job = data.maintenanceJobs.find((j) => j.job_id === job_id);
    if (!job) return res.status(404).json({ error: `Job ${job_id} not found in processed dataset` });

    const needMin = jobDurationMinutes(job);
    const matchingBlocks = data.blocks
      .filter((b) => b.section_id === job.section_id && String(b.status).toLowerCase() === 'available')
      .map((b) => {
        const leftover = b.duration_minutes - needMin;
        const trains = trainsInWindow(data.trainMovements, b.section_id, toMinutes(b.start_time), toMinutes(b.end_time));
        const fits = leftover >= 0;
        const fit_score = fits
          ? Math.max(40, Math.min(100, Math.round(100 - leftover / 8 - trains.length * 4)))
          : 0;
        const reasons = [];
        reasons.push(`Same section ${job.section_id}`);
        if (fits) reasons.push(`Window ${b.duration_minutes} min covers job ${needMin} min (leftover ${leftover} min)`);
        else reasons.push(`Too short: window ${b.duration_minutes} min, job needs ${needMin} min`);
        reasons.push(trains.length === 0
          ? 'No train movements overlap this possession'
          : `${trains.length} train(s) occupy this section during the window`);
        return {
          ...b,
          leftover_minutes: leftover,
          trains_in_window: trains.length,
          train_ids: trains.slice(0, 5).map((t) => t.train_id),
          fits,
          fit_score,
          reasons
        };
      })
      .filter((b) => b.fits)
      .sort((a, b) => b.fit_score - a.fit_score || a.leftover_minutes - b.leftover_minutes)
      .slice(0, 5);

    return res.json({
      success: true,
      method: 'rule-based match (same section, duration, leftover, train occupancy)',
      explanation: `Forward planning holds job ${job.job_id} fixed and searches possession windows on ${job.section_id} that are long enough (${needMin} min).`,
      job: { ...job, duration_minutes: needMin },
      bestBlocks: matchingBlocks,
      empty_reason: matchingBlocks.length === 0
        ? `No available window on ${job.section_id} is ≥ ${needMin} minutes.`
        : null
    });
  } catch (error) {
    console.error('Error in forward planning:', error);
    res.status(500).json({ error: 'Forward planning failed' });
  }
});

// ─── POST /api/planning/reverse  (Block → work package with fill %) ──────────
router.post('/reverse', async (req, res) => {
  try {
    const { block_id } = req.body;
    const data = readRealData();

    const block = data.blocks.find((b) => b.block_id === block_id);
    if (!block) return res.status(404).json({ error: `Block ${block_id} not found in processed dataset` });

    const blockDurationHours = block.duration_minutes / 60;
    const compatibleJobs = data.maintenanceJobs
      .filter((j) => j.section_id === block.section_id && (j.status === 'Pending' || !j.status) && j.estimated_duration <= blockDurationHours)
      .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));

    let remainingHours = blockDurationHours;
    const bundled = [];
    for (const job of compatibleJobs) {
      if (job.estimated_duration <= remainingHours) {
        bundled.push(job);
        remainingHours -= job.estimated_duration;
      }
    }

    const usedHours = blockDurationHours - remainingHours;
    const fillPct = blockDurationHours > 0 ? Math.round((usedHours / blockDurationHours) * 100) : 0;
    const departments = [...new Set(bundled.map((j) => j.department))];
    const trains = trainsInWindow(data.trainMovements, block.section_id, toMinutes(block.start_time), toMinutes(block.end_time));

    return res.json({
      success: true,
      method: 'greedy pack by priority_score into a fixed possession window',
      explanation: `Reverse planning holds block ${block.block_id} (${block.start_time}–${block.end_time} on ${block.section_id}) fixed and packs compatible pending jobs so the granted corridor is not wasted.`,
      block,
      trains_in_window: trains.length,
      recommendedWorkPackage: {
        bundled_jobs: bundled,
        total_duration_hours: Number(usedHours.toFixed(2)),
        block_duration_hours: blockDurationHours,
        fill_percent: fillPct,
        leftover_minutes: Math.round(remainingHours * 60),
        cross_department: departments.length > 1,
        departments,
        reasons: bundled.length
          ? [
              `Packed ${bundled.length} job(s) using ${Math.round(usedHours * 60)} of ${block.duration_minutes} min (${fillPct}% fill).`,
              departments.length > 1
                ? `Cross-department bundle: ${departments.join(' + ')} share one possession.`
                : `Single department: ${departments[0] || 'n/a'}.`,
              trains.length === 0
                ? 'Window sits in a train-free gap.'
                : `${trains.length} train movement(s) already occupy this section in that clock range.`
            ]
          : [`No pending jobs on ${block.section_id} fit inside ${block.duration_minutes} minutes.`]
      }
    });
  } catch (error) {
    console.error('Error in reverse planning:', error);
    res.status(500).json({ error: 'Reverse planning failed' });
  }
});

async function solveSection(data, sectionId, extraJobs = []) {
  const pending = data.maintenanceJobs
    .filter((j) => j.section_id === sectionId && (j.status === 'Pending' || !j.status))
    .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
    .slice(0, 6);

  const jobs = [...extraJobs, ...pending.filter((j) => !extraJobs.some((e) => e.job_id === j.job_id))];
  const trains = data.trainMovements.filter((t) => t.section_id === sectionId).slice(0, 20);
  const windows = data.blocks.filter((b) => b.section_id === sectionId && String(b.status).toLowerCase() === 'available');

  const optResult = await runOptimizer({
    action: 'replan',
    jobs,
    trains,
    available_windows: windows,
    horizon: 1440
  });

  return { jobs, optResult };
}

// ─── POST /api/planning/replan  (Emergency CP-SAT with before/after) ─────────
router.post('/replan', async (req, res) => {
  try {
    const { section_id, defect_type, department } = req.body;
    const data = readRealData();
    const sec = section_id || 'S01';
    const cache = loadDemoCache();

    const emergencyJob = {
      job_id: 'EMG_DEMO',
      section_id: sec,
      department: department || 'SMMS',
      defect_type: defect_type || 'Critical Signal Failure',
      priority: 'Critical',
      estimated_duration: 1,
      priority_score: 99
    };

    const baselineRun = await solveSection(data, sec, []);
    const afterRun = await solveSection(data, sec, [emergencyJob]);

    const liveOk = optimizerLooksUsable(baselineRun.optResult) && optimizerLooksUsable(afterRun.optResult);

    if (!liveOk) {
      const fallback = cache && (sec === 'S01' || !section_id) ? cache : cache;
      if (!fallback) {
        return res.status(503).json({ error: 'Optimizer unavailable and no cached demo result' });
      }
      return res.json({
        success: true,
        source: 'cached_demo',
        message: 'Cached CP-SAT demo result (Python optimizer not reachable). Same S01 incident, frozen schedule.',
        added_job: fallback.incident,
        affected_section: fallback.section_id,
        optimizer_status: fallback.status,
        feasible: true,
        baseline_blocks: fallback.baseline.scheduled_blocks,
        scheduled_blocks: fallback.after.scheduled_blocks,
        baseline_disruption_cost: fallback.baseline.total_disruption_cost,
        total_disruption_cost: fallback.after.total_disruption_cost,
        moved_jobs: fallback.moved_jobs,
        explanation: fallback.explanation
      });
    }

    const beforeBlocks = annotateSchedule(baselineRun.optResult.blocks, sec);
    const afterBlocks = annotateSchedule(afterRun.optResult.blocks, sec);
    const moved = diffSchedules(beforeBlocks, afterBlocks);

    return res.json({
      success: true,
      source: 'live_cpsat',
      message: 'Dynamic CP-SAT replanning completed (baseline vs emergency).',
      added_job: emergencyJob,
      affected_section: sec,
      optimizer_status: afterRun.optResult.status || 'OPTIMAL',
      feasible: afterRun.optResult.feasible ?? true,
      baseline_blocks: beforeBlocks,
      scheduled_blocks: afterBlocks,
      baseline_disruption_cost: baselineRun.optResult.total_disruption_cost || 0,
      total_disruption_cost: afterRun.optResult.total_disruption_cost || 0,
      moved_jobs: moved,
      reverse_planning_windows: afterRun.optResult.reverse_planning_windows || [],
      explanation: moved.length
        ? `Emergency job EMG_DEMO inserted on ${sec}. ${moved.length} existing job(s) shifted to keep possessions feasible.`
        : `Emergency job EMG_DEMO inserted on ${sec} without moving other jobs.`
    });
  } catch (error) {
    console.error('Error during replanning:', error);
    const cache = loadDemoCache();
    if (cache) {
      return res.json({
        success: true,
        source: 'cached_demo',
        message: 'Cached CP-SAT demo result after optimizer error.',
        added_job: cache.incident,
        affected_section: cache.section_id,
        optimizer_status: cache.status,
        feasible: true,
        baseline_blocks: cache.baseline.scheduled_blocks,
        scheduled_blocks: cache.after.scheduled_blocks,
        baseline_disruption_cost: cache.baseline.total_disruption_cost,
        total_disruption_cost: cache.after.total_disruption_cost,
        moved_jobs: cache.moved_jobs,
        explanation: cache.explanation
      });
    }
    res.status(500).json({ error: 'Replanning failed' });
  }
});

export default router;
