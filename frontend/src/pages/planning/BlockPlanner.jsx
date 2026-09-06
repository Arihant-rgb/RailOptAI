import { useMemo } from 'react'
import { CalendarDays, CheckCircle, Clock, FileCheck } from 'lucide-react'
import mockData from '../../data/mockData.json'

const blockStatusColors = {
  Approved: 'badge-success',
  Proposed: 'badge-info',
  Completed: 'bg-gray-100 text-gray-700'
}

const blockBarColors = {
  Approved: 'bg-emerald-500',
  Proposed: 'bg-blue-500',
  Completed: 'bg-gray-400'
}

export default function BlockPlanner() {
  const { blocks } = mockData

  const stats = useMemo(() => ({
    total: blocks.length,
    approved: blocks.filter(b => b.status === 'Approved').length,
    proposed: blocks.filter(b => b.status === 'Proposed').length,
    completed: blocks.filter(b => b.status === 'Completed').length
  }), [blocks])

  // Group blocks by section
  const blocksBySection = useMemo(() => {
    const groups = {}
    blocks.forEach(b => {
      if (!groups[b.section]) groups[b.section] = []
      groups[b.section].push(b)
    })
    return groups
  }, [blocks])

  // Convert time string to position percentage (0-24h scale)
  const timeToPercent = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number)
    return ((h + m / 60) / 24) * 100
  }

  const blockWidth = (start, end) => {
    let s = timeToPercent(start)
    let e = timeToPercent(end)
    if (e < s) e += 100 * (24/24) // handle overnight blocks (simplified — wraps)
    // For display simplicity, just show absolute width
    return Math.max(e - s, 5) // minimum 5% width
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Blocks', value: stats.total, icon: CalendarDays, color: 'text-rail-700', bg: 'bg-blue-50' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
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
        <h3 className="text-base font-semibold text-gray-900 mb-4">Block Timeline</h3>

        {/* Time axis header */}
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
              {sectionBlocks.map((block) => {
                const left = timeToPercent(block.startTime)
                const width = blockWidth(block.startTime, block.endTime)
                return (
                  <div
                    key={block.id}
                    className={`absolute top-1 h-8 rounded-md ${blockBarColors[block.status]} text-white text-[10px] flex items-center justify-center px-1 shadow-sm cursor-pointer hover:opacity-90 transition-opacity`}
                    style={{ left: `${left}%`, width: `${width}%`, minWidth: '60px' }}
                    title={`${block.id}: ${block.startTime}-${block.endTime} (${block.type})`}
                  >
                    <span className="truncate">{block.id}</span>
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
                <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Start</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">End</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Line</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Assigned Jobs</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((block) => (
                <tr key={block.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs font-medium">{block.id}</td>
                  <td className="py-3 px-4">{block.section}</td>
                  <td className="py-3 px-4">{block.date}</td>
                  <td className="py-3 px-4">{block.startTime}</td>
                  <td className="py-3 px-4">{block.endTime}</td>
                  <td className="py-3 px-4">{block.type}</td>
                  <td className="py-3 px-4">{block.line}</td>
                  <td className="py-3 px-4">
                    <span className={`badge ${blockStatusColors[block.status]}`}>{block.status}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs">
                    {block.assignedJobs.length > 0 ? block.assignedJobs.join(', ') : <span className="text-gray-400">None</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
