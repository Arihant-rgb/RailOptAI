import { useState, useEffect } from 'react'
import { RefreshCw, ArrowRight, AlertTriangle, Layers, CalendarCheck, Info } from 'lucide-react'
import { forwardPlanning, reversePlanning, triggerReplanning } from '../../services/api'
import api from '../../services/api'

function JobOption({ job }) {
  return `${job.job_id} · ${job.defect_type} · ${job.section_id} · ${job.estimated_duration}h · ${job.priority}`
}

function BlockOption({ block }) {
  return `${block.block_id} · ${block.section_id} · ${block.start_time}–${block.end_time} · ${block.duration_minutes} min`
}

function ScheduleList({ blocks, highlightId }) {
  if (!blocks?.length) {
    return <p className="text-xs text-gray-400 py-4 text-center">No scheduled jobs returned.</p>
  }
  return (
    <div className="space-y-2">
      {blocks.map((block, idx) => (
        <div
          key={block.job_id || idx}
          className={`p-3 border rounded-lg flex items-center justify-between ${
            block.job_id === highlightId || block.is_emergency ? 'border-red-300 bg-red-50' : 'bg-white'
          }`}
        >
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-rail-700">{block.job_id}</span>
              <span className="badge badge-info text-[10px]">{block.department}</span>
              {block.within_reverse_planning_window && (
                <span className="badge badge-success text-[10px]">Train-free gap</span>
              )}
              {(block.job_id === highlightId || block.is_emergency) && (
                <span className="badge badge-critical text-[10px]">Emergency</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Section {block.section_id || block.block_id} · {block.start_time} – {block.end_time}
            </p>
          </div>
          <div className="text-right text-xs">
            <span className="text-gray-500">Disruption </span>
            <span className="font-bold text-gray-800">{block.disruption_cost || 0}m</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Replanning() {
  const [activeTab, setActiveTab] = useState('forward')
  const [jobs, setJobs] = useState([])
  const [blocks, setBlocks] = useState([])
  const [sections, setSections] = useState([])

  const [forwardJobId, setForwardJobId] = useState('TMS001')
  const [forwardResult, setForwardResult] = useState(null)
  const [forwardLoading, setForwardLoading] = useState(false)

  const [reverseBlockId, setReverseBlockId] = useState('B026')
  const [reverseResult, setReverseResult] = useState(null)
  const [reverseLoading, setReverseLoading] = useState(false)

  const [emergencySection, setEmergencySection] = useState('S01')
  const [emergencyDefect, setEmergencyDefect] = useState('Critical Signal Failure')
  const [replanResult, setReplanResult] = useState(null)
  const [replanLoading, setReplanLoading] = useState(false)

  useEffect(() => {
    async function loadCatalog() {
      try {
        const { data } = await api.get('/api/planning/catalog')
        setJobs(data.jobs || [])
        setBlocks(data.blocks || [])
        setSections(data.sections || [])
        if (data.demoDefaults) {
          setForwardJobId(data.demoDefaults.job_id)
          setReverseBlockId(data.demoDefaults.block_id)
          setEmergencySection(data.demoDefaults.section_id)
          setEmergencyDefect(data.demoDefaults.defect_type)
        }
      } catch (err) {
        console.warn('Catalog load failed', err)
      }
    }
    loadCatalog()
  }, [])

  const handleForwardPlanning = async (e) => {
    e?.preventDefault()
    try {
      setForwardLoading(true)
      const res = await forwardPlanning({ job_id: forwardJobId })
      setForwardResult(res)
    } catch (err) {
      setForwardResult({ error: err.response?.data?.error || err.message, bestBlocks: [] })
    } finally {
      setForwardLoading(false)
    }
  }

  const handleReversePlanning = async (e) => {
    e?.preventDefault()
    try {
      setReverseLoading(true)
      const res = await reversePlanning({ block_id: reverseBlockId })
      setReverseResult(res)
    } catch (err) {
      setReverseResult({ error: err.response?.data?.error || err.message })
    } finally {
      setReverseLoading(false)
    }
  }

  const handleEmergencyReplan = async (e) => {
    e?.preventDefault()
    try {
      setReplanLoading(true)
      const res = await triggerReplanning({
        emergency_job_id: 'EMG_DEMO',
        section_id: emergencySection,
        defect_type: emergencyDefect,
        department: 'SMMS'
      })
      setReplanResult(res)
    } catch (err) {
      setReplanResult({ error: err.response?.data?.error || err.message })
    } finally {
      setReplanLoading(false)
    }
  }

  const useBlockInReverse = (blockId) => {
    setReverseBlockId(blockId)
    setActiveTab('reverse')
  }

  const simulateOnSection = (sectionId) => {
    setEmergencySection(sectionId)
    setActiveTab('replan')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Planning & Dynamic Replanning</h2>
        <p className="text-sm text-gray-500 mt-1">
          Three operator questions. Same processed dataset. Each result lists the rules that produced it.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { n: '1', title: 'Forward', blurb: 'Job is fixed. Which possession window fits?' },
          { n: '2', title: 'Reverse', blurb: 'Window is already granted. Which jobs can share it?' },
          { n: '3', title: 'Emergency', blurb: 'A defect appeared. Re-solve the day with CP-SAT.' }
        ].map((s) => (
          <div key={s.n} className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-[11px] font-bold text-rail-600 uppercase">Step {s.n} · {s.title}</p>
            <p className="text-xs text-gray-600 mt-1">{s.blurb}</p>
          </div>
        ))}
      </div>

      <div className="flex border-b border-gray-200 gap-4 overflow-x-auto">
        {[
          { id: 'forward', label: 'Forward (Job → Block)', icon: CalendarCheck },
          { id: 'reverse', label: 'Reverse (Block → Package)', icon: Layers },
          { id: 'replan', label: 'Emergency CP-SAT', icon: AlertTriangle }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-rail-600 text-rail-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'forward' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2">Pick a maintenance job</h3>
            <p className="text-xs text-gray-500 flex gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Demo default: TMS001 Gauge Widening on S11 (1h, Critical).
            </p>
            <form onSubmit={handleForwardPlanning} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Job</label>
                <select
                  value={forwardJobId}
                  onChange={(e) => setForwardJobId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  {jobs.map((job) => (
                    <option key={job.job_id} value={job.job_id}>{JobOption({ job })}</option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={forwardLoading} className="w-full py-2 bg-rail-600 hover:bg-rail-700 text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2">
                {forwardLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Find matching windows
              </button>
            </form>
          </div>

          <div className="card lg:col-span-2 space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2">Candidate possession windows</h3>
            {forwardResult?.error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{forwardResult.error}</p>
            )}
            {forwardResult && !forwardResult.error ? (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1">
                  <p>{forwardResult.explanation}</p>
                  <p>
                    Job <strong>{forwardResult.job?.job_id}</strong> · {forwardResult.job?.defect_type} · Section {forwardResult.job?.section_id} · {forwardResult.job?.duration_minutes} min · Priority {forwardResult.job?.priority}
                  </p>
                </div>
                {forwardResult.bestBlocks?.length ? (
                  forwardResult.bestBlocks.map((b) => (
                    <div key={b.block_id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <span className="font-mono text-xs font-bold text-rail-700">{b.block_id}</span>
                          <p className="text-xs text-gray-600">{b.section_id} · {b.start_time}–{b.end_time} · leftover {b.leftover_minutes} min</p>
                        </div>
                        <span className="badge badge-success">Fit {b.fit_score}</span>
                      </div>
                      <ul className="text-[11px] text-gray-600 list-disc pl-4 space-y-0.5">
                        {(b.reasons || []).map((r) => <li key={r}>{r}</li>)}
                      </ul>
                      <button
                        type="button"
                        onClick={() => useBlockInReverse(b.block_id)}
                        className="text-xs font-medium text-rail-700 hover:underline"
                      >
                        Use this block in Reverse →
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    {forwardResult.empty_reason || 'No window long enough on this section.'}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-8 text-center">Choose a job and find windows. Fit score is leftover time + train occupancy, not a made-up 92%.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'reverse' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2">Pick a granted block</h3>
            <p className="text-xs text-gray-500 flex gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Demo default: B026 on S01, 01:00–04:00 (180 min night possession).
            </p>
            <form onSubmit={handleReversePlanning} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Block</label>
                <select
                  value={reverseBlockId}
                  onChange={(e) => setReverseBlockId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  {blocks.map((block) => (
                    <option key={block.block_id} value={block.block_id}>{BlockOption({ block })}</option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={reverseLoading} className="w-full py-2 bg-rail-600 hover:bg-rail-700 text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2">
                {reverseLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                Pack compatible jobs
              </button>
            </form>
          </div>

          <div className="card lg:col-span-2 space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2">Recommended work package</h3>
            {reverseResult?.error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{reverseResult.error}</p>
            )}
            {reverseResult && !reverseResult.error ? (
              <div className="space-y-3">
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 space-y-1">
                  <p>{reverseResult.explanation}</p>
                  <p>
                    Fill <strong>{reverseResult.recommendedWorkPackage?.fill_percent}%</strong>
                    {' '}({reverseResult.recommendedWorkPackage?.total_duration_hours}h of {reverseResult.recommendedWorkPackage?.block_duration_hours}h)
                    · leftover {reverseResult.recommendedWorkPackage?.leftover_minutes} min
                  </p>
                </div>
                {(reverseResult.recommendedWorkPackage?.reasons || []).map((r) => (
                  <p key={r} className="text-xs text-gray-600">• {r}</p>
                ))}
                {reverseResult.recommendedWorkPackage?.bundled_jobs?.length ? (
                  reverseResult.recommendedWorkPackage.bundled_jobs.map((j) => (
                    <div key={j.job_id} className="p-3 border rounded-lg flex items-center justify-between">
                      <div>
                        <span className="font-mono text-xs font-bold text-gray-900">{j.job_id}</span>
                        <p className="text-xs text-gray-600">{j.defect_type} · {j.department} · {j.estimated_duration}h</p>
                      </div>
                      <span className="badge badge-info">{j.priority}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    No pending jobs on this section fit the window.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => simulateOnSection(reverseResult.block?.section_id || 'S01')}
                  className="text-xs font-medium text-red-700 hover:underline"
                >
                  Simulate emergency on {reverseResult.block?.section_id} →
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-8 text-center">Fill % is used minutes / window minutes, packed by stored priority_score.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'replan' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Frozen demo incident
            </h3>
            <p className="text-xs text-gray-500">
              Same incident every click: EMG_DEMO · Critical Signal Failure · 60 min · SMMS. Compare the day before vs after CP-SAT.
            </p>
            <form onSubmit={handleEmergencyReplan} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Section</label>
                <select
                  value={emergencySection}
                  onChange={(e) => setEmergencySection(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  {(sections.length ? sections : ['S01']).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Incident</label>
                <input
                  type="text"
                  value={emergencyDefect}
                  readOnly
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50"
                />
              </div>
              <button type="submit" disabled={replanLoading} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2">
                {replanLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                Re-solve day (CP-SAT)
              </button>
            </form>
          </div>

          <div className="card lg:col-span-2 space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2">Before vs after</h3>
            {replanResult?.error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{replanResult.error}</p>
            )}
            {replanResult && !replanResult.error ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-bold text-sm text-emerald-900">{replanResult.message}</p>
                    <span className="badge badge-success text-xs font-mono">
                      {replanResult.source === 'live_cpsat' ? 'Live CP-SAT' : 'Cached demo'} · {replanResult.optimizer_status}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800">{replanResult.explanation}</p>
                  <p className="text-xs text-emerald-800">
                    Inserted <strong>{replanResult.added_job?.job_id}</strong> on {replanResult.affected_section}.
                    Disruption {replanResult.baseline_disruption_cost ?? 0}m → <strong>{replanResult.total_disruption_cost}m</strong>.
                  </p>
                </div>

                {replanResult.moved_jobs?.length > 0 && (
                  <div className="text-xs text-gray-700 space-y-1">
                    <p className="font-semibold">Jobs that moved</p>
                    {replanResult.moved_jobs.map((m) => (
                      <p key={m.job_id}>{m.job_id}: {m.from} → {m.to}</p>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-700 uppercase mb-2">Before emergency</h4>
                    <ScheduleList blocks={replanResult.baseline_blocks} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-700 uppercase mb-2">After EMG_DEMO</h4>
                    <ScheduleList blocks={replanResult.scheduled_blocks} highlightId="EMG_DEMO" />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-8 text-center">Run S01 to show a delta, not a random new list of IDs.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
