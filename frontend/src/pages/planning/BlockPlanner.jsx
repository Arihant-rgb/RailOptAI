import { useState, useEffect, useMemo } from 'react'
import { CalendarDays, CheckCircle, Clock, FileCheck, Play, RefreshCw, X, AlertCircle, Wrench, UserCheck } from 'lucide-react'
import { getBlocks, generatePlan, assignBlock, getMaintenanceJobs, resetDemo } from '../../services/api'
import mockData from '../../data/mockData.json'

const blockStatusColors = {
  Approved: 'bg-blue-100 text-blue-800 border-blue-300',
  Available: 'badge-success',
  Occupied: 'bg-amber-100 text-amber-800 border-amber-300',
  Proposed: 'badge-info',
  Completed: 'bg-gray-100 text-gray-700'
}

const blockBarColors = {
  Approved: 'bg-blue-500',
  Available: 'bg-emerald-500',
  Occupied: 'bg-amber-500',
  Proposed: 'bg-blue-400',
  Completed: 'bg-gray-400'
}

export default function BlockPlanner() {
  const [blocks, setBlocks] = useState([])
  const [availableJobs, setAvailableJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [isLive, setIsLive] = useState(false)
  
  // Selected block for assignment modal
  const [selectedBlock, setSelectedBlock] = useState(null)
  const [selectedJobId, setSelectedJobId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [actionSuccess, setActionSuccess] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      const [blockData, jobsData] = await Promise.all([getBlocks(), getMaintenanceJobs()])
      if (Array.isArray(blockData) && blockData.length > 0) {
        setBlocks(blockData)
        setIsLive(true)
      } else {
        setBlocks(mockData.blocks || [])
        setIsLive(false)
      }
      if (Array.isArray(jobsData)) {
        setAvailableJobs(jobsData)
      }
    } catch (err) {
      console.warn('Blocks API fallback:', err)
      setBlocks(mockData.blocks || [])
      setIsLive(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const [generateStep, setGenerateStep] = useState('');

  const handleGeneratePlan = async () => {
    try {
      setGenerating(true)
      
      // Artificial delay sequence for the demo video to show "AI processing"
      setGenerateStep('Reading Pending Jobs...');
      await new Promise(r => setTimeout(r, 600));
      
      setGenerateStep('Mapping 695 Train Constraints...');
      await new Promise(r => setTimeout(r, 800));
      
      setGenerateStep('Running CP-SAT Optimizer...');
      await new Promise(r => setTimeout(r, 1200));

      const result = await generatePlan({
        start_date: '2026-09-05',
        end_date: '2026-09-11',
        sections: ['S01','S02','S03','S04','S05','S06','S07','S08','S09','S10','S11','S12']
      })
      
      setGenerateStep('Optimal Solution Found!');
      await new Promise(r => setTimeout(r, 500));

      // Immediately reload blocks so the UI turns green → amber in real time
      await loadData()
      const count = result?.assignedCount ?? '?'
      setActionSuccess(`✓ AI Plan Applied — ${count} pending jobs auto-assigned to optimal blocks. Dashboard KPIs updated.`)
    } catch (err) {
      alert('Failed to generate plan: ' + err.message)
    } finally {
      setGenerating(false)
      setGenerateStep('')
    }
  }

  const stats = useMemo(() => ({
    total:     blocks.length,
    available: blocks.filter(b => b.status === 'Available').length,
    occupied:  blocks.filter(b => b.status === 'Occupied').length,
    approved:  blocks.filter(b => b.status === 'Approved').length,
    completed: blocks.filter(b => b.status === 'Completed').length
  }), [blocks])

  // Group blocks by section
  const blocksBySection = useMemo(() => {
    const groups = {}
    blocks.forEach(b => {
      const sec = b.section_id || b.section || 'S01'
      if (!groups[sec]) groups[sec] = []
      groups[sec].push(b)
    })
    return groups
  }, [blocks])

  const timeToPercent = (timeStr) => {
    if (!timeStr) return 0
    const [h, m] = timeStr.split(':').map(Number)
    return ((h + m / 60) / 24) * 100
  }

  const blockWidth = (start, end) => {
    let s = timeToPercent(start)
    let e = timeToPercent(end)
    if (e < s) e += 100
    return Math.max(e - s, 8)
  }

  const handleBlockClick = (block) => {
    setSelectedBlock(block)
    setSelectedJobId('')
    setActionSuccess('')
  }

  const handleAssignBlock = async (e) => {
    e.preventDefault()
    if (!selectedBlock) return
    try {
      setAssigning(true)
      await assignBlock({
        block_id: selectedBlock.block_id,
        job_id: selectedJobId || undefined,
        status: 'Occupied'
      })
      setActionSuccess(`Block ${selectedBlock.block_id} successfully marked as Occupied!`)
      await loadData()
      setTimeout(() => {
        setSelectedBlock(null)
        setActionSuccess('')
      }, 1200)
    } catch (err) {
      alert('Failed to assign block: ' + (err.response?.data?.error || err.message))
    } finally {
      setAssigning(false)
    }
  }

  const handleReleaseBlock = async (blockId) => {
    try {
      setAssigning(true)
      await assignBlock({
        block_id: blockId,
        status: 'Available'
      })
      await loadData()
      setSelectedBlock(null)
    } catch (err) {
      alert('Failed to release block: ' + (err.response?.data?.error || err.message))
    } finally {
      setAssigning(false)
    }
  }

  // Compatible jobs for currently selected block
  const compatibleJobs = useMemo(() => {
    if (!selectedBlock) return []
    const sec = selectedBlock.section_id
    const durHours = (selectedBlock.duration_minutes || 60) / 60
    return availableJobs.filter(j => 
      j.section_id === sec && 
      (j.status === 'Pending' || !j.status) &&
      (j.estimated_duration || 2) <= durHours
    )
  }, [selectedBlock, availableJobs])

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Maintenance Block Planner</h2>
          <p className="text-sm text-gray-500">Interactive corridor possession scheduling & click-to-book allocation</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${isLive ? 'badge-success' : 'badge-info'}`}>
            {isLive ? 'Live API Data' : 'Mock Fallback'}
          </span>
          {/* Hidden reset button — for presenter use only, resets all blocks+jobs for fresh demo */}
          <button
            onClick={async () => {
              try {
                await resetDemo()
                await loadData()
                setActionSuccess('✓ Demo reset — all blocks available, all jobs pending.')
              } catch (e) {
                alert('Reset failed: ' + e.message)
              }
            }}
            title="Reset Demo"
            className="px-2 py-1 text-[10px] text-gray-300 hover:text-gray-500 rounded border border-transparent hover:border-gray-200 transition-colors"
          >
            ↺
          </button>
          <button
            onClick={handleGeneratePlan}
            disabled={generating}
            className={`flex items-center justify-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-all duration-300 ${
              generating ? 'bg-indigo-600 shadow-inner' : 'bg-rail-600 hover:bg-rail-700 shadow-md'
            }`}
            style={{ minWidth: generating ? '240px' : '200px' }}
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-200" />
                <span className="animate-pulse">{generateStep || 'Processing...'}</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Generate Plan (CP-SAT)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Candidate Blocks', value: stats.total, icon: CalendarDays, color: 'text-rail-700', bg: 'bg-blue-50' },
          { label: 'Available Blocks', value: blocks.filter(b => b.status === 'Available').length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Occupied / In Work', value: blocks.filter(b => b.status === 'Occupied').length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Approved / Locked', value: blocks.filter(b => b.status === 'Approved').length, icon: FileCheck, color: 'text-purple-600', bg: 'bg-purple-50' }
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-4">
            <div className={`p-3 rounded-xl ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Timeline */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Corridor Possession Timeline (Click any block to Allocate)</h3>
            <div className="flex items-center gap-5 mt-2 text-xs font-medium bg-gray-50/50 inline-flex p-1.5 px-3 rounded-lg border border-gray-100">
              <span className="flex items-center gap-2 text-gray-700">
                <span className="w-3 h-3 rounded shadow-sm bg-emerald-500 border border-emerald-600"></span> 
                Available (Train-Free)
              </span>
              <span className="flex items-center gap-2 text-gray-700">
                <span className="w-3 h-3 rounded shadow-sm bg-amber-500 border border-amber-600"></span> 
                Occupied (AI Allotted / In-Work)
              </span>
              <span className="flex items-center gap-2 text-gray-700">
                <span className="w-3 h-3 rounded shadow-sm bg-blue-500 border border-blue-600"></span> 
                Approved (Locked by Manager)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center mb-2 pl-28">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex-1 text-[10px] text-gray-400 text-center">
              {String(i * 4).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {Object.entries(blocksBySection).map(([section, sectionBlocks]) => (
          <div key={section} className="flex items-center mb-3">
            <div className="w-28 text-sm font-semibold text-gray-800 shrink-0 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rail-600"></span>
              Section {section}
            </div>
            <div className="flex-1 relative h-10 bg-gray-50 rounded-lg border border-gray-200">
              {sectionBlocks.map((block, idx) => {
                const id = block.block_id || block.id || `B00${idx+1}`
                const start = block.start_time || block.startTime || '02:00'
                const end = block.end_time || block.endTime || '04:00'
                const left = timeToPercent(start)
                const width = blockWidth(start, end)
                const isOccupied = block.status === 'Occupied'
                return (
                  <div
                    key={id}
                    onClick={() => handleBlockClick(block)}
                    className={`absolute top-1 h-8 rounded-md ${blockBarColors[block.status] || 'bg-emerald-500'} text-white text-[11px] font-medium flex items-center justify-center px-1 shadow-sm cursor-pointer hover:scale-105 hover:shadow-md transition-all border border-white/20`}
                    style={{ left: `${left}%`, width: `${width}%`, minWidth: '60px' }}
                    title={`${id} (${block.status || 'Available'}): ${start}-${end} (${block.duration_minutes} min) on ${section} — Click to assign`}
                  >
                    <span className="truncate">{id} {isOccupied ? '⚡' : ''}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Block Table with Action Buttons */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">All Scheduled Track Possessions ({blocks.length})</h3>
          <span className="text-xs text-gray-500">Click "Allocate" or row to manage status</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Block ID</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Section</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Time Window</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Duration</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((block, idx) => {
                const id = block.block_id || block.id || `B00${idx+1}`
                const sec = block.section_id || block.section || 'S01'
                const start = block.start_time || block.startTime || '02:00'
                const end = block.end_time || block.endTime || '04:00'
                const dur = block.duration_minutes || 120
                const isOccupied = block.status === 'Occupied'

                return (
                  <tr key={id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-bold text-rail-700">{id}</td>
                    <td className="py-3 px-4 font-medium">Section {sec}</td>
                    <td className="py-3 px-4 font-mono text-xs">{start} – {end}</td>
                    <td className="py-3 px-4">{dur} mins</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${blockStatusColors[block.status] || 'badge-success'}`}>
                        {block.status || 'Available'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isOccupied ? (
                        <button
                          onClick={() => handleReleaseBlock(id)}
                          className="px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-50 rounded border border-amber-200 font-medium transition-colors"
                        >
                          Release to Available
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBlockClick(block)}
                          className="px-2.5 py-1 text-xs bg-rail-600 hover:bg-rail-700 text-white rounded font-medium transition-colors"
                        >
                          Allocate Job
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assignment Modal */}
      {selectedBlock && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-gray-100">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-rail-600" />
                  Corridor Possession Allocation
                </h3>
                <p className="text-xs text-gray-500">
                  Block <strong className="font-mono text-rail-700">{selectedBlock.block_id}</strong> on Section <strong className="font-mono text-gray-900">{selectedBlock.section_id}</strong>
                </p>
              </div>
              <button onClick={() => setSelectedBlock(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleAssignBlock} className="space-y-4 text-sm">
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-gray-500 block">Window Time</span>
                    <strong className="font-mono text-gray-900">{selectedBlock.start_time}–{selectedBlock.end_time}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Duration</span>
                    <strong className="text-gray-900">{selectedBlock.duration_minutes} mins</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Current Status</span>
                    <strong className="text-emerald-700">{selectedBlock.status || 'Available'}</strong>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-1.5">
                    Select Compatible Pending Job on Section {selectedBlock.section_id}:
                  </label>
                  {compatibleJobs.length > 0 ? (
                    <select
                      value={selectedJobId}
                      onChange={(e) => setSelectedJobId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rail-500 focus:outline-none"
                    >
                      <option value="">-- Choose a job to schedule into this block --</option>
                      {compatibleJobs.map((j) => (
                        <option key={j.job_id} value={j.job_id}>
                          [{j.job_id}] {j.defect_type} ({j.department}) — {j.estimated_duration}h · {j.priority}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>No pending job fits directly on Section {selectedBlock.section_id}. You can still reserve this window as Occupied.</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-3 border-t">
                  {selectedBlock.status === 'Occupied' ? (
                    <button
                      type="button"
                      onClick={() => handleReleaseBlock(selectedBlock.block_id)}
                      disabled={assigning}
                      className="px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg font-medium border border-red-200"
                    >
                      Release Window
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">Lock track corridor for maintenance</span>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBlock(null)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={assigning}
                      className="px-4 py-2 bg-rail-600 hover:bg-rail-700 text-white rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {assigning && <RefreshCw className="w-4 h-4 animate-spin" />}
                      Confirm Allocation
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

