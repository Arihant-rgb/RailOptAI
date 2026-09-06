import { useState, useEffect, useMemo } from 'react'
import { Wrench, Filter, Plus, RefreshCw, X } from 'lucide-react'
import { getMaintenanceJobs, createMaintenanceJob } from '../../services/api'
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
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)

  const [sourceFilter, setSourceFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sectionFilter, setSectionFilter] = useState('All')

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [newJob, setNewJob] = useState({
    job_id: '',
    department: 'TMS',
    section_id: 'S01',
    asset_id: 'TRK105',
    asset_type: 'Track',
    defect_type: 'Rail Crack',
    severity: 5,
    overdue_days: 3,
    estimated_duration: 2,
    priority: 'Critical',
    status: 'Pending'
  })

  const loadJobs = async () => {
    try {
      setLoading(true)
      const data = await getMaintenanceJobs({
        department: sourceFilter !== 'All' ? sourceFilter : undefined,
        section: sectionFilter !== 'All' ? sectionFilter : undefined,
        priority: priorityFilter !== 'All' ? priorityFilter : undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined
      })
      if (Array.isArray(data) && data.length > 0) {
        setJobs(data)
        setIsLive(true)
      } else {
        setJobs(mockData.maintenanceJobs)
        setIsLive(false)
      }
    } catch (err) {
      console.warn('Using local fallback mockData for jobs:', err)
      setJobs(mockData.maintenanceJobs)
      setIsLive(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadJobs()
  }, [sourceFilter, priorityFilter, statusFilter, sectionFilter])

  const handleCreateJob = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...newJob,
        job_id: newJob.job_id || `TMS${Date.now().toString().slice(-3)}`
      }
      await createMaintenanceJob(payload)
      setShowModal(false)
      loadJobs()
    } catch (err) {
      alert('Failed to save job to backend: ' + err.message)
    }
  }

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      const src = job.department || job.source || 'TMS'
      const sec = job.section_id || job.section || ''
      if (sourceFilter !== 'All' && src.toLowerCase() !== sourceFilter.toLowerCase()) return false
      if (priorityFilter !== 'All' && job.priority !== priorityFilter) return false
      if (statusFilter !== 'All' && job.status !== statusFilter) return false
      if (sectionFilter !== 'All' && sec.toLowerCase() !== sectionFilter.toLowerCase()) return false
      return true
    })
  }, [jobs, sourceFilter, priorityFilter, statusFilter, sectionFilter])

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Unified Maintenance Jobs</h2>
          <p className="text-sm text-gray-500">Cross-department maintenance requests from TMS, SMMS, and TDMS</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${isLive ? 'badge-success' : 'badge-info'}`}>
            {isLive ? 'Live API Data' : 'Local Fallback'}
          </span>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-rail-600 hover:bg-rail-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Job
          </button>
        </div>
      </div>

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
            <option value="All">All Sources / Depts</option>
            <option value="TMS">TMS (Track)</option>
            <option value="SMMS">SMMS (Signals)</option>
            <option value="TDMS">TDMS (OHE)</option>
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
            <option value="S01">S01</option>
            <option value="S02">S02</option>
            <option value="S03">S03</option>
          </select>

          <span className="ml-auto text-sm text-gray-500 flex items-center gap-2">
            {loading && <RefreshCw className="w-4 h-4 animate-spin text-rail-600" />}
            Showing <strong className="text-gray-900">{filtered.length}</strong> of {jobs.length} jobs
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
                <th className="text-left py-3 px-4 font-medium text-gray-500">Defect Type</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Severity</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Priority</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Est. Duration</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Block ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job, idx) => {
                const id = job.job_id || job.id || `JOB_${idx}`
                const dept = job.department || job.source || 'TMS'
                const sec = job.section_id || job.section || 'S01'
                const defect = job.defect_type || job.description || 'Maintenance'
                const dur = job.estimated_duration || job.estimatedDuration || 2

                return (
                  <tr key={id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-medium text-rail-700">{id}</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${sourceColors[dept] || 'bg-gray-100 text-gray-800'}`}>{dept}</span>
                    </td>
                    <td className="py-3 px-4 font-medium">{sec}</td>
                    <td className="py-3 px-4">{defect}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-gray-700">{job.severity || 3}/5</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${priorityColors[job.priority] || 'badge-info'}`}>{job.priority || 'Medium'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${statusColors[job.status] || 'bg-gray-100'}`}>{job.status || 'Pending'}</span>
                    </td>
                    <td className="py-3 px-4 text-center">{dur} hrs</td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {job.block_id || job.assignedBlock || <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">No maintenance jobs found</p>
            <p className="text-sm">Try resetting filters or adding a job</p>
          </div>
        )}
      </div>

      {/* Add Job Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">Add Maintenance Job</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-3 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Job ID</label>
                <input
                  type="text"
                  placeholder="e.g. TMS005"
                  value={newJob.job_id}
                  onChange={(e) => setNewJob({ ...newJob, job_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rail-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Department</label>
                  <select
                    value={newJob.department}
                    onChange={(e) => setNewJob({ ...newJob, department: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="TMS">TMS (Track)</option>
                    <option value="SMMS">SMMS (Signal)</option>
                    <option value="TDMS">TDMS (OHE)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Section</label>
                  <select
                    value={newJob.section_id}
                    onChange={(e) => setNewJob({ ...newJob, section_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="S01">S01</option>
                    <option value="S02">S02</option>
                    <option value="S03">S03</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Defect Type</label>
                <input
                  type="text"
                  value={newJob.defect_type}
                  onChange={(e) => setNewJob({ ...newJob, defect_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Priority</label>
                  <select
                    value={newJob.priority}
                    onChange={(e) => setNewJob({ ...newJob, priority: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Est. Duration (hrs)</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={newJob.estimated_duration}
                    onChange={(e) => setNewJob({ ...newJob, estimated_duration: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rail-600 hover:bg-rail-700 text-white rounded-lg font-medium"
                >
                  Save Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
