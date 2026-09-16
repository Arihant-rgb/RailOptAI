import { useState, useMemo } from 'react'
import { Brain, Sparkles, AlertTriangle, SlidersHorizontal, Trophy, History, Flame, ArrowUpRight, ArrowDownRight, Minus, CheckCircle2 } from 'lucide-react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Legend, Tooltip
} from 'recharts'
import mockData from '../../data/mockData.json'

// ── Score calculation logic (SIH Blueprint Section 13) ──────────────────
function calculateScoreBreakdown(job, overrides = {}) {
  const sev = overrides.severity ?? job.severity ?? 4
  const criticality = Math.min(100, sev * 20)

  const overdue = overrides.overdueDays ?? job.overdue_days ?? 7
  let urgency = 0
  if (overdue >= 15) urgency = 100
  else if (overdue >= 8) urgency = 75
  else if (overdue >= 4) urgency = 50
  else if (overdue >= 1) urgency = 25

  const assetImpact = overrides.assetImpact ?? job.asset_impact ?? (job.priority === 'Critical' ? 90 : 60)
  const delayRisk = overrides.delayRisk ?? job.delay_risk ?? 85

  const totalScore = Math.round(
    0.45 * criticality + 0.25 * urgency + 0.20 * assetImpact + 0.10 * delayRisk
  )

  return { criticality, urgency, assetImpact, delayRisk, totalScore }
}

// ── Decision tier helper ────────────────────────────────────────────────
function getDecisionTier(score) {
  if (score >= 75) return { label: 'Schedule Immediately', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', badge: 'badge-critical' }
  if (score >= 50) return { label: 'Schedule This Week', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'badge-warning' }
  return { label: 'Can Defer', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', badge: 'badge-info' }
}

// ── Mock audit log generator ────────────────────────────────────────────
function generateAuditLog(job) {
  const id = job.job_id || job.id || 'TMS-001'
  const baseDate = new Date('2026-09-10T06:00:00')
  return [
    { ts: new Date(baseDate.getTime()), score: 62, action: 'AI Scored', actor: 'System', inputs: 'Severity 3, Overdue 5d', delta: null },
    { ts: new Date(baseDate.getTime() + 86400000), score: 68, action: 'AI Re-scored', actor: 'System', inputs: 'Overdue increased to 6d', delta: +6 },
    { ts: new Date(baseDate.getTime() + 86400000 * 2), score: 78, action: 'Severity Upgraded', actor: 'SSE/P.Way (Manual)', inputs: 'Severity 3→4', delta: +10 },
    { ts: new Date(baseDate.getTime() + 86400000 * 3), score: 78, action: 'Block Recommended', actor: 'AI Engine', inputs: `Block window assigned for ${id}`, delta: 0 },
    { ts: new Date(baseDate.getTime() + 86400000 * 4), score: 85, action: 'Priority Override', actor: 'DRM Office', inputs: 'Emergency uplift — safety audit', delta: +7 },
  ]
}

// ── Heatmap data generator ──────────────────────────────────────────────
function generateHeatmapData(jobs) {
  const sections = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12']
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const grid = []

  sections.forEach((sec) => {
    const row = { section: sec }
    const sectionJobs = jobs.filter(j => (j.section_id || j.section || '').includes(sec.replace('S', '')))
    days.forEach((day, di) => {
      // Distribute jobs across the week with some variance
      const baseLoad = sectionJobs.length
      const variance = Math.sin(di * 1.5 + sections.indexOf(sec) * 0.8) * 2
      const criticalCount = sectionJobs.filter(j => j.priority === 'Critical').length
      const score = Math.max(0, Math.min(100, Math.round(baseLoad * 12 + criticalCount * 20 + variance * 10 + (di < 5 ? 15 : -10))))
      row[day] = { score, jobs: Math.max(0, Math.round(baseLoad * 0.4 + variance)), critical: Math.max(0, Math.round(criticalCount * 0.3 + (di % 3 === 0 ? 1 : 0))) }
    })
    grid.push(row)
  })
  return { sections, days, grid }
}

function heatColor(score) {
  if (score >= 80) return 'bg-red-500 text-white'
  if (score >= 60) return 'bg-orange-400 text-white'
  if (score >= 40) return 'bg-amber-300 text-gray-900'
  if (score >= 20) return 'bg-emerald-200 text-gray-900'
  return 'bg-emerald-100 text-gray-600'
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════
export default function PriorityEngine() {
  const jobs = mockData.maintenanceJobs || []
  const blocks = mockData.blocks || []
  const [selectedJobId, setSelectedJobId] = useState(jobs[0]?.id || 'TMS-2024-001')

  // What-If overrides
  const [simOverrides, setSimOverrides] = useState({})
  const [simActive, setSimActive] = useState(false)

  // Compare mode for radar
  const [compareJobId, setCompareJobId] = useState('')

  const selectedJob = jobs.find(j => (j.job_id || j.id) === selectedJobId) || jobs[0] || {}
  const compareJob = compareJobId ? jobs.find(j => (j.job_id || j.id) === compareJobId) : null

  const breakdown = selectedJob ? calculateScoreBreakdown(selectedJob, simActive ? simOverrides : {}) : { criticality: 0, urgency: 0, assetImpact: 0, delayRisk: 0, totalScore: 0 }
  const baseBreakdown = selectedJob ? calculateScoreBreakdown(selectedJob) : breakdown
  const scoreDelta = breakdown.totalScore - baseBreakdown.totalScore

  const compareBreakdown = compareJob ? calculateScoreBreakdown(compareJob) : null

  // ── Ranked Leaderboard ──────────────────────────────────────────────
  const rankedJobs = useMemo(() => {
    return jobs
      .map(job => ({
        ...job,
        _id: job.job_id || job.id,
        _score: calculateScoreBreakdown(job).totalScore,
        _breakdown: calculateScoreBreakdown(job),
        _tier: getDecisionTier(calculateScoreBreakdown(job).totalScore),
      }))
      .sort((a, b) => b._score - a._score)
  }, [jobs])

  // ── Best block recommendation ───────────────────────────────────────
  const jobSection = selectedJob.section_id || selectedJob.section
  const jobDurationMins = (selectedJob.estimated_duration || 2) * 60
  const bestBlock = blocks
    .filter(b => b.section_id === jobSection && b.status === 'Available' && b.duration_minutes >= jobDurationMins)
    .sort((a, b) => Math.abs(a.duration_minutes - jobDurationMins) - Math.abs(b.duration_minutes - jobDurationMins))[0] || null

  const windowText = bestBlock
    ? `${bestBlock.start_time}–${bestBlock.end_time} window (${bestBlock.duration_minutes} min) on ${jobSection}`
    : jobSection
      ? `No available block found on ${jobSection} — schedule via Dynamic Replanning`
      : 'Select a job to see recommended window'

  // ── Radar data ──────────────────────────────────────────────────────
  const radarData = [
    { factor: 'Criticality', A: breakdown.criticality, ...(compareBreakdown && { B: compareBreakdown.criticality }), fullMark: 100 },
    { factor: 'Urgency', A: breakdown.urgency, ...(compareBreakdown && { B: compareBreakdown.urgency }), fullMark: 100 },
    { factor: 'Asset Impact', A: breakdown.assetImpact, ...(compareBreakdown && { B: compareBreakdown.assetImpact }), fullMark: 100 },
    { factor: 'Delay Risk', A: breakdown.delayRisk, ...(compareBreakdown && { B: compareBreakdown.delayRisk }), fullMark: 100 },
  ]

  // ── Audit log ───────────────────────────────────────────────────────
  const auditLog = useMemo(() => generateAuditLog(selectedJob), [selectedJobId])

  // ── Heatmap ─────────────────────────────────────────────────────────
  const heatmap = useMemo(() => generateHeatmapData(jobs), [jobs])

  // ── Slider handler ──────────────────────────────────────────────────
  const handleSliderChange = (key, value) => {
    setSimActive(true)
    setSimOverrides(prev => ({ ...prev, [key]: Number(value) }))
  }

  const resetSimulation = () => {
    setSimActive(false)
    setSimOverrides({})
  }

  // ── Factor bar config ───────────────────────────────────────────────
  const factors = [
    { key: 'criticality', label: 'Criticality', weight: '45%', sliderKey: 'severity', sliderLabel: 'Severity', sliderMin: 1, sliderMax: 5, sliderValue: simOverrides.severity ?? selectedJob.severity ?? 4, barColor: 'bg-red-500', score: breakdown.criticality },
    { key: 'urgency', label: 'Urgency', weight: '25%', sliderKey: 'overdueDays', sliderLabel: 'Overdue Days', sliderMin: 0, sliderMax: 30, sliderValue: simOverrides.overdueDays ?? selectedJob.overdue_days ?? 7, barColor: 'bg-amber-500', score: breakdown.urgency },
    { key: 'assetImpact', label: 'Asset Impact', weight: '20%', sliderKey: 'assetImpact', sliderLabel: 'Impact Score', sliderMin: 0, sliderMax: 100, sliderValue: simOverrides.assetImpact ?? selectedJob.asset_impact ?? (selectedJob.priority === 'Critical' ? 90 : 60), barColor: 'bg-blue-500', score: breakdown.assetImpact },
    { key: 'delayRisk', label: 'Delay Risk', weight: '10%', sliderKey: 'delayRisk', sliderLabel: 'Risk Score', sliderMin: 0, sliderMax: 100, sliderValue: simOverrides.delayRisk ?? selectedJob.delay_risk ?? 85, barColor: 'bg-emerald-500', score: breakdown.delayRisk },
  ]

  const tier = getDecisionTier(breakdown.totalScore)

  return (
    <div className="space-y-6">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" /> Explainable AI Priority Engine
          </h2>
          <p className="text-sm text-gray-500">Multi-criteria decision matrix · Radar visualization · What-If simulation · Decision audit</p>
        </div>
      </div>

      {/* ═══ SECTION 1: RANKED LEADERBOARD ═══ */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold text-gray-900 text-sm">AI Priority Leaderboard</h3>
          <span className="text-xs text-gray-400 ml-auto">{rankedJobs.length} jobs ranked by composite score</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-500 w-12">Rank</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Job ID</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Defect / Description</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Section</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500">Crit</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500">Urg</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500">Asset</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500">Risk</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500">Score</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">AI Decision</th>
              </tr>
            </thead>
            <tbody>
              {rankedJobs.slice(0, 10).map((job, idx) => {
                const isSelected = job._id === selectedJobId
                return (
                  <tr
                    key={job._id}
                    onClick={() => { setSelectedJobId(job._id); resetSimulation() }}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                        idx === 0 ? 'bg-red-500 text-white' : idx === 1 ? 'bg-amber-500 text-white' : idx === 2 ? 'bg-yellow-400 text-gray-900' : 'bg-gray-100 text-gray-600'
                      }`}>
                        #{idx + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-bold text-rail-700">{job._id}</td>
                    <td className="py-3 px-4 text-xs text-gray-700 max-w-[200px] truncate">{job.defect_type || job.description || 'Maintenance'}</td>
                    <td className="py-3 px-4 text-xs font-medium">{job.section_id || job.section}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="w-8 h-1.5 rounded-full bg-gray-100 mx-auto overflow-hidden"><div className="h-full bg-red-500 rounded-full" style={{ width: `${job._breakdown.criticality}%` }} /></div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="w-8 h-1.5 rounded-full bg-gray-100 mx-auto overflow-hidden"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${job._breakdown.urgency}%` }} /></div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="w-8 h-1.5 rounded-full bg-gray-100 mx-auto overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${job._breakdown.assetImpact}%` }} /></div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="w-8 h-1.5 rounded-full bg-gray-100 mx-auto overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${job._breakdown.delayRisk}%` }} /></div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-lg font-extrabold text-purple-700">{job._score}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${job._tier.badge} text-xs`}>{job._tier.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ SECTION 2: DEEP ANALYSIS — Radar + Sliders + Score Card ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Radar Chart + Compare ── */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Multi-Factor Radar Profile</h3>
          </div>

          {/* Compare selector */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Overlay comparison job:</label>
            <select
              value={compareJobId}
              onChange={(e) => setCompareJobId(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              <option value="">None (single job view)</option>
              {jobs.filter(j => (j.job_id || j.id) !== selectedJobId).map(j => (
                <option key={j.job_id || j.id} value={j.job_id || j.id}>
                  {j.job_id || j.id} — {(j.defect_type || j.description || 'Job').substring(0, 30)}
                </option>
              ))}
            </select>
          </div>

          {/* Radar Chart */}
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="factor" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#9ca3af' }} />
              <Radar name={selectedJob.job_id || selectedJob.id || 'Job'} dataKey="A" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.25} strokeWidth={2} />
              {compareBreakdown && (
                <Radar name={compareJob.job_id || compareJob.id || 'Compare'} dataKey="B" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} />
              )}
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
            </RadarChart>
          </ResponsiveContainer>

          {compareBreakdown && (
            <div className="flex items-center justify-between text-xs p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-amber-900">
                <strong>{compareJob.job_id || compareJob.id}</strong>: Score {compareBreakdown.totalScore}/100
              </span>
              <span className={`font-bold ${breakdown.totalScore > compareBreakdown.totalScore ? 'text-purple-700' : 'text-amber-700'}`}>
                Δ {breakdown.totalScore - compareBreakdown.totalScore > 0 ? '+' : ''}{breakdown.totalScore - compareBreakdown.totalScore}
              </span>
            </div>
          )}
        </div>

        {/* ── Right: Score Card + What-If Sliders ── */}
        {selectedJob && (
          <div className="card lg:col-span-2 space-y-5">
            {/* Job Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <span className="text-xs font-mono font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                  {selectedJob.job_id || selectedJob.id}
                </span>
                <h3 className="text-lg font-bold text-gray-900 mt-1">
                  {selectedJob.defect_type || selectedJob.description || 'Track Defect'}
                </h3>
                <p className="text-xs text-gray-500">
                  Department: <strong>{selectedJob.department || selectedJob.source || 'TMS'}</strong> | Section: <strong>{selectedJob.section_id || selectedJob.section}</strong>
                </p>
              </div>

              {/* Score Badge with Delta */}
              <div className="text-right">
                <span className="text-xs text-gray-500 font-medium block">AI Priority Score</span>
                <div className="flex items-end justify-end gap-1.5">
                  <span className="text-4xl font-extrabold text-purple-700">{breakdown.totalScore}</span>
                  {simActive && scoreDelta !== 0 && (
                    <span className={`text-sm font-bold mb-1 flex items-center gap-0.5 ${scoreDelta > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {scoreDelta > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {scoreDelta > 0 ? '+' : ''}{scoreDelta}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400 block">/ 100</span>
                <span className={`badge ${tier.badge} mt-1 text-xs`}>{tier.label}</span>
              </div>
            </div>

            {/* Simulation Toggle */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-purple-600" />
                {simActive ? 'What-If Simulation Mode' : 'Component Score Weights'}
                {simActive && <span className="badge badge-critical text-[10px] animate-pulse">SIMULATING</span>}
              </h4>
              {simActive && (
                <button onClick={resetSimulation} className="text-xs text-purple-600 hover:text-purple-800 font-medium">
                  Reset to Actual Values
                </button>
              )}
            </div>

            {/* Factor Bars with What-If Sliders */}
            <div className="space-y-4">
              {factors.map((f) => (
                <div key={f.key}>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-gray-700">{f.label} ({f.weight} Weight)</span>
                    <span className="font-bold text-purple-700">{f.score} / 100</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mb-2">
                    <div className={`${f.barColor} h-full rounded-full transition-all duration-500 ease-out`} style={{ width: `${f.score}%` }} />
                  </div>
                  {/* Slider */}
                  <div className="flex items-center gap-3 pl-1">
                    <span className="text-[10px] text-gray-400 w-20 shrink-0">{f.sliderLabel}:</span>
                    <input
                      type="range"
                      min={f.sliderMin}
                      max={f.sliderMax}
                      value={f.sliderValue}
                      onChange={(e) => handleSliderChange(f.sliderKey, e.target.value)}
                      className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                    <span className="text-xs font-mono font-bold text-gray-800 w-8 text-right">{f.sliderValue}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Explainability Rationale */}
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2 text-xs text-purple-950">
              <p className="font-bold text-sm text-purple-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-purple-700" /> Explainability Rationale:
              </p>
              <ul className="list-disc list-inside space-y-1 text-purple-800">
                <li>Severity {factors[0].sliderValue}/5 contributes {Math.round(0.45 * breakdown.criticality)} points to priority.</li>
                <li>{factors[1].sliderValue} days overdue adds {Math.round(0.25 * breakdown.urgency)} urgency score.</li>
                <li>Asset impact score of {breakdown.assetImpact} contributes {Math.round(0.20 * breakdown.assetImpact)} points.</li>
                <li>Requires power block: <strong>{selectedJob.power_block_required ? 'Yes (OHE Isolation)' : 'No'}</strong>.</li>
                <li>Recommended window: <strong>{windowText}</strong>.</li>
                {simActive && <li className="text-red-700 font-semibold">⚠ Simulation active — values above are hypothetical overrides, not live data.</li>}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ═══ SECTION 3: AI DECISION AUDIT TRAIL ═══ */}
      <div className="card">
        <div className="flex items-center gap-2 border-b pb-3 mb-4">
          <History className="w-4 h-4 text-purple-600" />
          <h3 className="font-semibold text-gray-900 text-sm">Decision Audit Trail</h3>
          <span className="text-xs text-gray-400">— {selectedJob.job_id || selectedJob.id}</span>
          <span className="ml-auto text-[10px] text-gray-400">Explainable AI compliance log · All scoring events tracked</span>
        </div>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-purple-100"></div>

          <div className="space-y-4">
            {auditLog.map((entry, idx) => (
              <div key={idx} className="flex items-start gap-4 relative">
                {/* Dot */}
                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center z-10 border-2 ${
                  entry.action.includes('Override') ? 'bg-amber-100 border-amber-400' :
                  entry.action.includes('Emergency') || entry.action.includes('Upgraded') ? 'bg-red-100 border-red-400' :
                  'bg-purple-100 border-purple-400'
                }`}>
                  <span className="text-[10px] font-bold text-gray-700">{entry.score}</span>
                </div>

                {/* Content */}
                <div className="flex-1 p-3 bg-white border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-900">{entry.action}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        entry.actor === 'System' || entry.actor === 'AI Engine' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {entry.actor === 'System' || entry.actor === 'AI Engine' ? 'AI Recommended' : 'Human Override'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.delta !== null && entry.delta !== 0 && (
                        <span className={`text-xs font-bold flex items-center gap-0.5 ${entry.delta > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {entry.delta > 0 ? <ArrowUpRight className="w-3 h-3" /> : entry.delta < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {entry.delta > 0 ? '+' : ''}{entry.delta}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 font-mono">
                        {entry.ts.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500">{entry.inputs}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ SECTION 4: CONFLICT RISK HEATMAP ═══ */}
      <div className="card">
        <div className="flex items-center gap-2 border-b pb-3 mb-4">
          <Flame className="w-4 h-4 text-red-500" />
          <h3 className="font-semibold text-gray-900 text-sm">Cross-Section Conflict Risk Heatmap</h3>
          <span className="ml-auto text-[10px] text-gray-400">Priority load concentration · Sections × 7-day forecast</span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 text-[10px]">
          <span className="text-gray-500 font-medium">Load Index:</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100"></span> Low (0-19)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-200"></span> Normal (20-39)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-300"></span> Elevated (40-59)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-400"></span> High (60-79)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500"></span> Critical (80+)</span>
        </div>

        {/* Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Day headers */}
            <div className="grid grid-cols-8 gap-1 mb-1">
              <div className="text-[10px] font-semibold text-gray-500 px-2">Section</div>
              {heatmap.days.map(d => (
                <div key={d} className="text-[10px] font-semibold text-gray-500 text-center">{d}</div>
              ))}
            </div>

            {/* Rows */}
            {heatmap.grid.map((row) => (
              <div key={row.section} className="grid grid-cols-8 gap-1 mb-1">
                <div className="text-[10px] font-bold text-gray-700 px-2 flex items-center">{row.section}</div>
                {heatmap.days.map(day => {
                  const cell = row[day]
                  return (
                    <div
                      key={day}
                      className={`h-10 rounded-md flex flex-col items-center justify-center cursor-default transition-transform hover:scale-105 ${heatColor(cell.score)}`}
                      title={`Section ${row.section} on ${day}: Load Index ${cell.score} | ${cell.jobs} jobs (${cell.critical} critical)`}
                    >
                      <span className="text-[10px] font-bold">{cell.score}</span>
                      {cell.critical > 0 && <span className="text-[8px] font-medium">⚠{cell.critical}</span>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
