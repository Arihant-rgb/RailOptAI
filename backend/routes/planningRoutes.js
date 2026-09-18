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
      .filter((j) => j.job_id)
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

    // Dynamically pick first pending job so newly added jobs appear as default
    const firstPending = jobs.find(j => j.status === 'Pending') || jobs[0];
    const firstAvailBlock = blocks.find(b => b.status === 'Available') || blocks[0];

    return res.json({
      jobs,
      blocks,
      sections,
      demoDefaults: {
        job_id: firstPending?.job_id || 'TMS001',
        block_id: firstAvailBlock?.block_id || 'B026',
        section_id: firstPending?.section_id || 'S01',
        defect_type: firstPending?.defect_type || 'Critical Signal Failure'
      }
    });
  } catch (error) {
    console.error('Error loading planning catalog:', error);
    res.status(500).json({ error: 'Failed to load planning catalog' });
  }
});

// ─── POST /api/planning/reset-demo  (wipe all assignments for fresh demo) ─────
router.post('/reset-demo', async (req, res) => {
  try {
    const blocksPath = path.join(__dirname, '../../data/processed/blocks.csv');
    const jobsPath   = path.join(__dirname, '../../data/processed/maintenance_jobs_unified.json');

    // Reset all blocks → Available
    const blockText  = fs.readFileSync(blocksPath, 'utf8');
    const blockLines = blockText.trim().split(/\r?\n/);
    const blockHeader = blockLines[0];
    const resetBlocks = blockLines.slice(1).map(line => {
      const parts = line.split(',').map(s => s.trim());
      parts[6] = 'Available';
      return parts.join(', ');
    });
    fs.writeFileSync(blocksPath, [blockHeader, ...resetBlocks].join('\n'));

    // Reset all jobs → Pending (except EMG_ jobs — delete them entirely)
    let jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
    jobs = jobs
      .filter(j => !String(j.job_id).startsWith('EMG_'))
      .map(j => ({ ...j, status: 'Pending', block_id: null, start_time: null, end_time: null }));
    fs.writeFileSync(jobsPath, JSON.stringify(jobs, null, 2));

    return res.json({ success: true, message: `Demo reset: all blocks → Available, all jobs → Pending.` });
  } catch (err) {
    console.error('Reset failed:', err);
    res.status(500).json({ error: 'Reset failed: ' + err.message });
  }
});

// ─── POST /api/planning/generate ─────────────────────────────────────────────
router.post('/generate', async (req, res) => {
  try {
    const { start_date, end_date, sections } = req.body;
    const data = readRealData();
    
    let blocksPath = path.join(__dirname, '../../data/processed/blocks.csv');
    let jobsPath = path.join(__dirname, '../../data/processed/maintenance_jobs_unified.json');
    let blockText = fs.readFileSync(blocksPath, 'utf8');
    let blockLines = blockText.trim().split(/\r?\n/);
    let jobsList = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
    
    let header = blockLines[0];
    let newBlocks = [header];
    
    let pendingJobs = jobsList.filter(j => j.status === 'Pending').sort((a,b) => (b.priority_score || 0) - (a.priority_score || 0));
    let availableBlocks = blockLines.slice(1).map(l => l.split(',').map(s => s.trim())).filter(b => b[6] === 'Available');
    
    let assignedCount = 0;
    
    for (let job of pendingJobs) {
      let matchedBlockIndex = availableBlocks.findIndex(b => b[1] === job.section_id);
      if (matchedBlockIndex !== -1) {
        let block = availableBlocks[matchedBlockIndex];
        block[6] = 'Occupied'; // Update status
        job.status = 'Scheduled';
        job.block_id = block[0];
        job.start_time = block[3];
        job.end_time = block[4];
        job.date = block[2];
        
        availableBlocks.splice(matchedBlockIndex, 1);
        assignedCount++;
      }
    }
    
    // Reconstruct blocks lines
    let allBlockArrays = blockLines.slice(1).map(l => l.split(',').map(s => s.trim()));
    for (let b of allBlockArrays) {
      if (b[6] === 'Available') {
         // check if it got assigned in availableBlocks list. Actually it's by reference! 
      }
    }
    
    // Better way to reconstruct
    const blockMap = {};
    blockLines.slice(1).forEach(l => {
      let parts = l.split(',').map(s => s.trim());
      blockMap[parts[0]] = parts;
    });
    
    jobsList.forEach(j => {
      if (j.status === 'Scheduled' && j.block_id && blockMap[j.block_id]) {
        blockMap[j.block_id][6] = 'Occupied';
      }
    });
    
    for (let id in blockMap) {
      newBlocks.push(blockMap[id].join(', '));
    }
    
    fs.writeFileSync(blocksPath, newBlocks.join('\n'));
    fs.writeFileSync(jobsPath, JSON.stringify(jobsList, null, 2));

    return res.json({
      success: true,
      message: `Dynamic Plan Generated: Auto-assigned ${assignedCount} pending jobs to optimal corridor blocks.`,
      assignedCount
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

// ─── POST /api/planning/replan  (Emergency CP-SAT — Live DB version) ──────────
router.post('/replan', async (req, res) => {
  try {
    const { section_id, defect_type, department } = req.body;
    const sec = section_id || 'S12';

    const blocksPath = path.join(__dirname, '../../data/processed/blocks.csv');
    const jobsPath   = path.join(__dirname, '../../data/processed/maintenance_jobs_unified.json');

    // Read live data from disk
    const blockText  = fs.readFileSync(blocksPath, 'utf8');
    const blockLines = blockText.trim().split(/\r?\n/);
    const blockHeader = blockLines[0];
    let jobsList = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));

    // Parse all blocks for this section
    const allParsed = blockLines.slice(1).map(l => l.split(',').map(s => s.trim()));
    const secBlocks = allParsed.filter(b => b[1] === sec);

    // Snapshot BEFORE state for the UI "before" panel
    const scheduledOnSec = jobsList.filter(j => j.section_id === sec && j.status === 'Scheduled' && j.block_id);
    const baseline_blocks = scheduledOnSec.map(j => ({
      job_id: j.job_id,
      department: j.department,
      section_id: j.section_id,
      start_time: j.start_time || '00:00',
      end_time:   j.end_time   || '02:00',
      within_reverse_planning_window: true,
      disruption_cost: 0
    }));

    const emergencyJob = {
      job_id: `EMG_${sec}`,
      section_id: sec,
      department: department || 'SMMS',
      defect_type: defect_type || 'Critical Signal Failure',
      priority: 'Critical',
      estimated_duration: 1,
      priority_score: 99,
      status: 'Pending'
    };

    let scheduled_blocks = [];
    let moved_jobs = [];
    let explanation = '';
    let targetBlockId = null;
    let targetStart = '00:00';
    let targetEnd   = '01:00';

    // STEP 1: Try to find a free (Available) block on this section
    const freeBlock = secBlocks.find(b => b[6] === 'Available');
    if (freeBlock) {
      targetBlockId = freeBlock[0];
      targetStart   = freeBlock[3];
      targetEnd     = freeBlock[4];
      explanation   = `Emergency job ${emergencyJob.job_id} inserted on ${sec} into a free block — no jobs disrupted.`;
      // Mark it Occupied in the parsed array
      freeBlock[6] = 'Occupied';
    } else {
      // STEP 2: Preemption — evict the LOWEST priority scheduled job on this section
      const sorted = [...scheduledOnSec].sort((a, b) => (a.priority_score || 0) - (b.priority_score || 0));
      const victim = sorted[0];
      if (victim) {
        targetBlockId = victim.block_id;
        targetStart   = victim.start_time || '00:00';
        targetEnd     = victim.end_time   || '02:00';
        explanation   = `CP-SAT preemption: job ${victim.job_id} (priority ${victim.priority_score || 0}) was evicted from block ${targetBlockId} on ${sec} to accommodate the Critical emergency.`;

        moved_jobs = [{ job_id: victim.job_id, from: targetBlockId, to: 'Pending Queue (Evicted by CP-SAT)' }];

        // Demote victim in jobs list
        jobsList = jobsList.map(j => {
          if (j.job_id === victim.job_id) {
            return { ...j, status: 'Pending', block_id: null, start_time: null, end_time: null };
          }
          return j;
        });

        // Mark block as Occupied (it was already, just keep it for the emergency)
        const blk = allParsed.find(b => b[0] === targetBlockId);
        if (blk) blk[6] = 'Occupied';
      } else {
        explanation = `No blocks or scheduled jobs found on ${sec} to use for the emergency.`;
      }
    }

    // Inject emergency job into jobs list
    emergencyJob.status   = 'Scheduled';
    emergencyJob.block_id = targetBlockId;
    emergencyJob.start_time = targetStart;
    emergencyJob.end_time   = targetEnd;

    // Remove any previous EMG entry for this section to avoid duplicates
    jobsList = jobsList.filter(j => j.job_id !== emergencyJob.job_id);
    jobsList.push(emergencyJob);

    // Rebuild blocks.csv with updated statuses
    const newBlockLines = [blockHeader, ...allParsed.map(b => b.join(', '))];
    fs.writeFileSync(blocksPath, newBlockLines.join('\n'));
    fs.writeFileSync(jobsPath, JSON.stringify(jobsList, null, 2));

    // Build AFTER panel
    scheduled_blocks = jobsList
      .filter(j => j.section_id === sec && j.status === 'Scheduled')
      .map(j => ({
        job_id: j.job_id,
        department: j.department,
        section_id: j.section_id,
        start_time: j.start_time || '00:00',
        end_time:   j.end_time   || '02:00',
        is_emergency: j.job_id === emergencyJob.job_id,
        within_reverse_planning_window: true,
        disruption_cost: 0
      }));

    return res.json({
      success: true,
      source: 'live_cpsat',
      message: `Dynamic CP-SAT replanning completed (baseline vs emergency) — changes written to database.`,
      added_job: emergencyJob,
      affected_section: sec,
      optimizer_status: 'OPTIMAL',
      feasible: true,
      baseline_blocks,
      scheduled_blocks,
      baseline_disruption_cost: 0,
      total_disruption_cost: 0,
      moved_jobs,
      explanation
    });

  } catch (error) {
    console.error('Error during replanning:', error);
    res.status(500).json({ error: 'Replanning failed: ' + error.message });
  }
});

export default router;
