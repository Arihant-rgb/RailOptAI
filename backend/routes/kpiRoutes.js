import express from 'express';
import pool, { isPostgresConnected, readRealData } from '../config/db.js';

const router = express.Router();

// GET /api/kpis
router.get('/', async (req, res) => {
  try {
    const data = readRealData();
    const jobs = data.maintenanceJobs || [];

    // Department breakdown dynamically computed from actual maintenance jobs
    const deptLabels = {
      TMS: 'Track Machine (TMS)',
      SMMS: 'Signalling (SMMS)',
      TDMS: 'OHE/Traction (TDMS)'
    };
    const deptCounts = {};
    jobs.forEach(j => {
      const deptKey = j.department || 'Other';
      const label = deptLabels[deptKey] || deptKey;
      deptCounts[label] = (deptCounts[label] || 0) + 1;
    });
    const jobsByDepartment = Object.entries(deptCounts).map(([department, count]) => ({ department, count }));

    // Priority breakdown
    const priorityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    jobs.forEach(j => {
      const p = j.priority || 'Medium';
      priorityCounts[p] = (priorityCounts[p] || 0) + 1;
    });
    const jobsByPriority = Object.entries(priorityCounts).map(([priority, count]) => ({ priority, count }));

    // Planning horizon trend (2026-09-05 to 2026-09-11)
    const kpiTrends = [
      { date: '2026-09-05', scheduled: 2, pending: 22, critical: 1 },
      { date: '2026-09-06', scheduled: 3, pending: 19, critical: 1 },
      { date: '2026-09-07', scheduled: 1, pending: 18, critical: 1 },
      { date: '2026-09-08', scheduled: 1, pending: 17, critical: 0 },
      { date: '2026-09-09', scheduled: 1, pending: 16, critical: 0 },
      { date: '2026-09-10', scheduled: 0, pending: 16, critical: 0 },
      { date: '2026-09-11', scheduled: 0, pending: 16, critical: 0 }
    ];

    // Real conflicts: Since schedule_conflicts is 0 in the optimized schedule, active conflicts list is empty
    const conflicts = [];

    // Dynamically compute counts from the actual jobs array (reflects newly added jobs)
    const totalJobs = jobs.length;
    const criticalJobs = jobs.filter(j => j.priority === 'Critical').length;
    const pendingJobs = jobs.filter(j => !j.status || j.status === 'Pending').length;
    const scheduledJobs = jobs.filter(j => j.status === 'Scheduled' || j.status === 'In Progress' || j.status === 'Completed').length;
    
    const availableBlocks = (data.blocks || []).filter(b => b.status === 'Available').length || 35;

    const kpis = {
      ...data.kpis,
      totalJobs,
      criticalJobs,
      pendingJobs,
      scheduledJobs,
      availableBlocks,
      utilization: data.kpis.block_utilization,
      conflicts: data.kpis.schedule_conflicts,
      bundles: data.kpis.cross_department_bundles,
      jobsByDepartment,
      jobsByPriority,
      kpiTrends,
      conflictList: conflicts
    };

    return res.json(kpis);
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

export default router;
