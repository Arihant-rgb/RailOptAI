import { useState, useEffect } from 'react'
import { Brain, Sparkles, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { getMaintenanceJobs, getBlocks } from '../../services/api'
import mockData from '../../data/mockData.json'

export default function PriorityEngine() {
  const [jobs, setJobs] = useState([])
  const [blocks, setBlocks] = useState([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [data, blockData] = await Promise.all([getMaintenanceJobs(), getBlocks()])
        if (Array.isArray(data) && data.length > 0) {
          setJobs(data)
          setSelectedJobId(data[0].job_id || data[0].id)
          setIsLive(true)
        } else {
          setJobs(mockData.maintenanceJobs)
          setSelectedJobId(mockData.maintenanceJobs[0].id)
          setIsLive(false)
        }
        if (Array.isArray(blockData) && blockData.length > 0) {
          setBlocks(blockData)
        }
      } catch (err) {
        console.warn('AI Priority API fallback:', err)
        setJobs(mockData.maintenanceJobs)
        setSelectedJobId(mockData.maintenanceJobs[0]?.id || 'TMS001')
        setIsLive(false)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const selectedJob = jobs.find(j => (j.job_id || j.id) === selectedJobId) || jobs[0] || {}

  // SIH Blueprint Section 13 Explainable AI Priority Calculation Formula
  const calculateScoreBreakdown = (job) => {
    const sev = job.severity || 4
    const criticality = Math.min(100, sev * 20)

    const overdue = job.overdue_days || 7
    let urgency = 0
    if (overdue >= 15) urgency = 100
    else if (overdue >= 8) urgency = 75
    else if (overdue >= 4) urgency = 50
    else if (overdue >= 1) urgency = 25

    const assetImpact = job.asset_impact || (job.priority === 'Critical' ? 90 : 60)
    const delayRisk = job.delay_risk || 85

    const totalScore = Math.round(
      0.45 * criticality + 0.25 * urgency + 0.20 * assetImpact + 0.10 * delayRisk
    )

    return { criticality, urgency, assetImpact, delayRisk, totalScore }
  }

  const breakdown = selectedJob ? calculateScoreBreakdown(selectedJob) : { criticality: 0, urgency: 0, assetImpact: 0, delayRisk: 0, totalScore: 0 }

  // Find the best available block for the selected job's section (longest duration that fits)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" /> Explainable AI Priority Engine
          </h2>
          <p className="text-sm text-gray-500">Multi-criteria decision matrix with dynamic score explainability</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${isLive ? 'badge-success' : 'badge-info'}`}>
            {isLive ? 'Live API Data' : 'Mock Fallback'}
          </span>
          {loading && <RefreshCw className="w-4 h-4 text-purple-600 animate-spin" />}
        </div>
      </div>

      {/* Selector & Details Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Job List */}
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-900 border-b pb-2">Select Maintenance Job</h3>
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {jobs.map((job, idx) => {
              const id = job.job_id || job.id || `JOB_${idx}`
              const isSelected = id === selectedJobId
              return (
                <div
                  key={id}
                  onClick={() => setSelectedJobId(id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-gray-900">{id}</span>
                    <span className={`badge ${job.priority === 'Critical' ? 'badge-critical' : 'badge-info'}`}>
                      {job.priority || 'Medium'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 truncate">
                    {job.defect_type || job.description || 'Defect'} ({job.section_id || job.section})
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Explainable AI Score Card */}
        {selectedJob && (
          <div className="card lg:col-span-2 space-y-6">
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

              {/* Score Badge */}
              <div className="text-right">
                <span className="text-xs text-gray-500 font-medium block">AI Priority Score</span>
                <span className="text-4xl font-extrabold text-purple-700">{breakdown.totalScore}</span>
                <span className="text-xs text-gray-400 block">/ 100</span>
              </div>
            </div>

            {/* Component Breakdown Bars */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" /> Component Score Weights
              </h4>

              {/* Criticality (45%) */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-gray-700">1. Criticality (45% Weight) — Severity: {selectedJob.severity || 4}/5</span>
                  <span className="font-bold text-purple-700">{breakdown.criticality} / 100</span>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-red-500 h-full rounded-full" style={{ width: `${breakdown.criticality}%` }} />
                </div>
              </div>

              {/* Urgency (25%) */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-gray-700">2. Urgency (25% Weight) — Overdue: {selectedJob.overdue_days || 5} Days</span>
                  <span className="font-bold text-purple-700">{breakdown.urgency} / 100</span>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${breakdown.urgency}%` }} />
                </div>
              </div>

              {/* Asset Impact (20%) */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-gray-700">3. Asset Impact (20% Weight) — Asset Type: {selectedJob.asset_type || 'Track'}</span>
                  <span className="font-bold text-purple-700">{breakdown.assetImpact} / 100</span>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: `${breakdown.assetImpact}%` }} />
                </div>
              </div>

              {/* Delay Risk (10%) */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-gray-700">4. Delay Risk (10% Weight) — Traffic & Freight Occupancy</span>
                  <span className="font-bold text-purple-700">{breakdown.delayRisk} / 100</span>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${breakdown.delayRisk}%` }} />
                </div>
              </div>
            </div>

            {/* Explainable AI Decision Reason */}
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2 text-xs text-purple-950">
              <p className="font-bold text-sm text-purple-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-purple-700" /> Explainability Rationale:
              </p>
              <ul className="list-disc list-inside space-y-1 text-purple-800">
                <li>High severity defect score ({selectedJob.severity || 4}/5) contributes {Math.round(0.45 * breakdown.criticality)} points to priority.</li>
                <li>{selectedJob.overdue_days || 5} days overdue adds {Math.round(0.25 * breakdown.urgency)} urgency score penalty.</li>
                <li>Requires power block: <strong>{selectedJob.power_block_required ? 'Yes (OHE Isolation)' : 'No'}</strong>.</li>
                <li>Recommended for priority scheduling during upcoming <strong>{windowText}</strong>.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
