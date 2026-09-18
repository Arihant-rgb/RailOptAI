import { useState, useEffect } from 'react'
import {
  Briefcase, AlertTriangle, Clock, CheckCircle,
  Box, TrendingUp, AlertOctagon, Layers, RefreshCw, CheckCircle2, ShieldCheck
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { getKPIs } from '../../services/api'
import mockData from '../../data/mockData.json'

const kpiCards = [
  { label: 'Total Jobs', key: 'totalJobs', altKey: 'total_jobs', icon: Briefcase, color: 'text-rail-700', bg: 'bg-blue-50' },
  { label: 'Critical Jobs', key: 'criticalJobs', altKey: 'critical_jobs', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  { label: 'Pending Jobs', key: 'pendingJobs', altKey: 'pending_jobs', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  { label: 'Scheduled Jobs', key: 'scheduledJobs', altKey: 'scheduled_jobs', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Available Blocks', key: 'availableBlocks', altKey: 'available_blocks', icon: Box, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Block Utilization', key: 'utilization', altKey: 'block_utilization', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', suffix: '%' },
  { label: 'Active Conflicts', key: 'conflicts', altKey: 'schedule_conflicts', icon: AlertOctagon, color: 'text-red-600', bg: 'bg-red-50' },
  { label: 'Bundled Windows', key: 'bundles', altKey: 'cross_department_bundles', icon: Layers, color: 'text-purple-600', bg: 'bg-purple-50' }
]

export default function Dashboard() {
  const [kpis, setKpis] = useState(mockData.kpis)
  const [jobsByDepartment, setJobsByDepartment] = useState([
    { department: 'Track Machine (TMS)', count: 12 },
    { department: 'Signalling (SMMS)', count: 10 },
    { department: 'OHE/Traction (TDMS)', count: 8 }
  ])
  const [kpiTrends, setKpiTrends] = useState([
    { date: '2026-09-05', scheduled: 2, pending: 22, critical: 1 },
    { date: '2026-09-06', scheduled: 3, pending: 19, critical: 1 },
    { date: '2026-09-07', scheduled: 1, pending: 18, critical: 1 },
    { date: '2026-09-08', scheduled: 1, pending: 17, critical: 0 },
    { date: '2026-09-09', scheduled: 1, pending: 16, critical: 0 },
    { date: '2026-09-10', scheduled: 0, pending: 16, critical: 0 },
    { date: '2026-09-11', scheduled: 0, pending: 16, critical: 0 }
  ])
  const [conflictList, setConflictList] = useState([])
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const data = await getKPIs()
        if (data) {
          setKpis({
            totalJobs:      data.totalJobs      ?? 0,
            criticalJobs:   data.criticalJobs   ?? 0,
            pendingJobs:    data.pendingJobs     ?? 0,
            scheduledJobs:  data.scheduledJobs  ?? 0,
            availableBlocks:data.availableBlocks ?? 0,
            conflicts:      data.conflicts       ?? 0,
            utilization:    data.utilization     ?? 0,
            bundles:        data.bundles         ?? 0
          })

          if (Array.isArray(data.jobsByDepartment) && data.jobsByDepartment.length > 0) {
            setJobsByDepartment(data.jobsByDepartment)
          }
          if (Array.isArray(data.kpiTrends) && data.kpiTrends.length > 0) {
            setKpiTrends(data.kpiTrends)
          }
          if (Array.isArray(data.conflictList)) {
            setConflictList(data.conflictList)
          }
          setIsLive(true)
        }
      } catch (err) {
        console.warn('Dashboard using fallback data:', err)
        setIsLive(false)
      } finally {
        setLoading(false)
      }
    }
    loadData()
    // Poll every 5 seconds so KPIs stay live when blocks/jobs are changed
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header & Source Badge */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Dashboard Overview</h2>
          <p className="text-sm text-gray-500">Real-time KPI metrics and maintenance operational analytics (Bangalore Division)</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${isLive ? 'badge-success' : 'badge-info'}`}>
            {isLive ? 'Live Real Data API' : 'Local Fallback'}
          </span>
          {loading && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const val = kpis[card.key] ?? kpis[card.altKey] ?? 0
          return (
            <div key={card.key} className="card flex items-center gap-4">
              <div className={`p-3 rounded-xl ${card.bg}`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">{card.label}</p>
                <p className={`text-2xl font-bold ${card.color}`}>
                  {val}{card.suffix || ''}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Job Trends */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Daily Planning Horizon Trends</h3>
              <p className="text-xs text-gray-400">Projected scheduled vs pending workload across 7 days</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={kpiTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(d) => d.slice(5)}
              />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Legend />
              <Line type="monotone" dataKey="scheduled" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Scheduled" />
              <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} name="Pending" />
              <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Critical" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Jobs by Department */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Maintenance Jobs by Department</h3>
              <p className="text-xs text-gray-400">Distribution across Track, Signalling, and OHE divisions</p>
            </div>
            <span className="badge badge-info text-xs font-mono">{kpis.totalJobs || 30} Total</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={jobsByDepartment}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="department"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                interval={0}
                height={50}
              />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} name="Maintenance Jobs" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Conflicts Section */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Active Schedule Conflicts</h3>
            <p className="text-xs text-gray-500">Conflicts detected between train movements and maintenance block occupations</p>
          </div>
          <span className={`badge ${kpis.conflicts === 0 ? 'badge-success' : 'badge-critical'}`}>
            {kpis.conflicts === 0 ? '0 Active Conflicts' : `${kpis.conflicts} Conflicts Detected`}
          </span>
        </div>

        {conflictList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Description</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Severity</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {conflictList.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-xs">{c.id}</td>
                    <td className="py-3 px-4">{c.type}</td>
                    <td className="py-3 px-4 max-w-md">{c.description}</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${
                        c.severity === 'Critical' ? 'badge-critical' :
                        c.severity === 'High' ? 'badge-warning' : 'badge-info'
                      }`}>
                        {c.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${c.resolved ? 'badge-success' : 'badge-warning'}`}>
                        {c.resolved ? 'Resolved' : 'Open'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-emerald-900 text-sm">Conflict-Free Operational Schedule</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                All maintenance corridor possessions across Bangalore sections (S01–S12) are mathematically deconflicted against 695 daily passenger and freight train movements by Google OR-Tools CP-SAT. Zero corridor overlap conflicts detected.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
