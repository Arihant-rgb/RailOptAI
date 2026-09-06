import { useState, useMemo } from 'react'
import { Wrench, Filter, Download } from 'lucide-react'
import mockData from '../../data/mockData.json'

const sourceColors = {
  TMS: 'bg-blue-100 text-blue-800',
  SMMS: 'bg-violet-100 text-violet-800',
  TDMS: 'bg-teal-100 text-teal-800'
}

const priorityColors = {
  Critical: 'badge-critical',
  High: 'badge-warning',
  Medium: 'badge-info',
  Low: 'bg-gray-100 text-gray-700'
}

const statusColors = {
  Pending: 'bg-amber-100 text-amber-800',
  Scheduled: 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-indigo-100 text-indigo-800',
  Completed: 'bg-emerald-100 text-emerald-800'
}

export default function Maintenance() {
  const [sourceFilter, setSourceFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sectionFilter, setSectionFilter] = useState('All')

  const filtered = useMemo(() => {
    return mockData.maintenanceJobs.filter((job) => {
      if (sourceFilter !== 'All' && job.source !== sourceFilter) return false
      if (priorityFilter !== 'All' && job.priority !== priorityFilter) return false
      if (statusFilter !== 'All' && job.status !== statusFilter) return false
      if (sectionFilter !== 'All' && job.section !== sectionFilter) return false
      return true
    })
  }, [sourceFilter, priorityFilter, statusFilter, sectionFilter])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Filter className="w-4 h-4" />
            <span className="font-medium">Filters:</span>
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rail-500"
          >
            <option value="All">All Sources</option>
            <option value="TMS">TMS</option>
            <option value="SMMS">SMMS</option>
            <option value="TDMS">TDMS</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rail-500"
          >
            <option value="All">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rail-500"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>

          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rail-500"
          >
            <option value="All">All Sections</option>
            <option value="BPL-ET">BPL - Itarsi</option>
            <option value="ET-JBP">Itarsi - JBP</option>
          </select>

          <span className="ml-auto text-sm text-gray-500">
            Showing <strong className="text-gray-900">{filtered.length}</strong> of {mockData.maintenanceJobs.length} jobs
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Job ID</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Source</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Section</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Department</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Description</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Priority</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Hrs</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Block</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs font-medium">{job.id}</td>
                  <td className="py-3 px-4">
                    <span className={`badge ${sourceColors[job.source]}`}>{job.source}</span>
                  </td>
                  <td className="py-3 px-4">{job.section}</td>
                  <td className="py-3 px-4 text-xs">{job.department}</td>
                  <td className="py-3 px-4 max-w-xs truncate" title={job.description}>{job.description}</td>
                  <td className="py-3 px-4">
                    <span className={`badge ${priorityColors[job.priority]}`}>{job.priority}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge ${statusColors[job.status]}`}>{job.status}</span>
                  </td>
                  <td className="py-3 px-4 text-xs">{job.requestedDate}</td>
                  <td className="py-3 px-4 text-center">{job.estimatedDuration}</td>
                  <td className="py-3 px-4 font-mono text-xs">
                    {job.assignedBlock || <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">No jobs match your filters</p>
            <p className="text-sm">Try adjusting your filter criteria</p>
          </div>
        )}
      </div>
    </div>
  )
}
