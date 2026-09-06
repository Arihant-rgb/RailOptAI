import { useState, useEffect, useMemo } from 'react'
import { CalendarDays, CheckCircle, Clock, FileCheck, Play, RefreshCw } from 'lucide-react'
import { getBlocks, generatePlan } from '../../services/api'
import mockData from '../../data/mockData.json'

const blockStatusColors = {
  Approved: 'badge-success',
  Available: 'badge-success',
  Proposed: 'badge-info',
  Completed: 'bg-gray-100 text-gray-700'
}

const blockBarColors = {
  Approved: 'bg-emerald-500',
  Available: 'bg-emerald-500',
  Proposed: 'bg-blue-500',
  Completed: 'bg-gray-400'
}

export default function BlockPlanner() {
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [isLive, setIsLive] = useState(false)

  const loadBlocks = async () => {
    try {
      setLoading(true)
      const data = await getBlocks()
      if (Array.isArray(data) && data.length > 0) {
        setBlocks(data)
        setIsLive(true)
      } else {
        setBlocks(mockData.blocks || [])
        setIsLive(false)
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
    loadBlocks()
  }, [])

  const handleGeneratePlan = async () => {
    try {
      setGenerating(true)
      await generatePlan({
        start_date: '2026-09-05',
        end_date: '2026-09-11',
        sections: ['S01', 'S02', 'S03']
      })
      alert('Optimized Block Plan generated successfully via backend optimizer engine!')
      loadBlocks()
    } catch (err) {
      alert('Failed to generate plan: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  const stats = useMemo(() => ({
    total: blocks.length,
    approved: blocks.filter(b => (b.status || 'Available') === 'Approved' || b.status === 'Available').length,
    proposed: blocks.filter(b => b.status === 'Proposed').length,
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

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Maintenance Block Planner</h2>
          <p className="text-sm text-gray-500">Constraint-optimized maintenance window scheduling</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${isLive ? 'badge-success' : 'badge-info'}`}>
            {isLive ? 'Live API Data' : 'Mock Fallback'}
          </span>
          <button
            onClick={handleGeneratePlan}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-rail-600 hover:bg-rail-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Generate Plan (CP-SAT)
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Candidate Blocks', value: stats.total, icon: CalendarDays, color: 'text-rail-700', bg: 'bg-blue-50' },
          { label: 'Available / Approved', value: stats.approved, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Proposed', value: stats.proposed, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Completed', value: stats.completed, icon: FileCheck, color: 'text-gray-600', bg: 'bg-gray-50' }
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

      {/* Timeline */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Candidate Block Timeline</h3>

        <div className="flex items-center mb-2 pl-28">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex-1 text-[10px] text-gray-400 text-center">
              {String(i * 4).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {Object.entries(blocksBySection).map(([section, sectionBlocks]) => (
          <div key={section} className="flex items-center mb-3">
            <div className="w-28 text-sm font-medium text-gray-700 shrink-0">{section}</div>
            <div className="flex-1 relative h-10 bg-gray-50 rounded-lg border border-gray-100">
              {sectionBlocks.map((block, idx) => {
                const id = block.block_id || block.id || `B00${idx+1}`
                const start = block.start_time || block.startTime || '02:00'
                const end = block.end_time || block.endTime || '04:00'
                const left = timeToPercent(start)
                const width = blockWidth(start, end)
                return (
                  <div
                    key={id}
                    className={`absolute top-1 h-8 rounded-md ${blockBarColors[block.status] || 'bg-emerald-500'} text-white text-[10px] flex items-center justify-center px-1 shadow-sm cursor-pointer hover:opacity-90 transition-opacity`}
                    style={{ left: `${left}%`, width: `${width}%`, minWidth: '60px' }}
                    title={`${id}: ${start}-${end}`}
                  >
                    <span className="truncate">{id}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Block Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">All Blocks</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Block ID</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Section</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Start Time</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">End Time</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Duration</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((block, idx) => {
                const id = block.block_id || block.id || `B00${idx+1}`
                const sec = block.section_id || block.section || 'S01'
                const start = block.start_time || block.startTime || '02:00'
                const end = block.end_time || block.endTime || '04:00'
                const dur = block.duration_minutes || 120

                return (
                  <tr key={id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-bold text-rail-700">{id}</td>
                    <td className="py-3 px-4 font-medium">{sec}</td>
                    <td className="py-3 px-4 font-mono text-xs">{start}</td>
                    <td className="py-3 px-4 font-mono text-xs">{end}</td>
                    <td className="py-3 px-4">{dur} mins</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${blockStatusColors[block.status] || 'badge-success'}`}>
                        {block.status || 'Available'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
