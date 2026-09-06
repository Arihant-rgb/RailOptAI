import { useState, useEffect } from 'react'
import {
  Briefcase, AlertTriangle, Clock, CheckCircle,
  Box, TrendingUp, AlertOctagon, Layers, RefreshCw
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
  { label: 'Pending Jobs', key: 'pendingJobs', altKey: 'scheduled_jobs', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  { label: 'Completed', key: 'completedJobs', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Available Blocks', key: 'availableBlocks', altKey: 'available_blocks', icon: Box, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Utilization', key: 'utilization', altKey: 'block_utilization', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', suffix: '%' },
  { label: 'Conflicts', key: 'conflicts', altKey: 'schedule_conflicts', icon: AlertOctagon, color: 'text-red-600', bg: 'bg-red-50' },
  { label: 'Bundles', key: 'bundles', altKey: 'cross_department_bundles', icon: Layers, color: 'text-purple-600', bg: 'bg-purple-50' }
]

export default function Dashboard() {
  const [kpis, setKpis] = useState(mockData.kpis)
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)

  const { kpiTrends, jobsByDepartment, conflicts } = mockData

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const data = await getKPIs()
        if (data) {
          setKpis(prev => ({
            ...prev,
            totalJobs: data.total_jobs ?? prev.totalJobs,
            criticalJobs: data.critical_jobs ?? prev.criticalJobs,
            pendingJobs: data.scheduled_jobs ?? prev.pendingJobs,
            availableBlocks: data.available_blocks ?? prev.availableBlocks,
            conflicts: data.schedule_conflicts ?? prev.conflicts,
            utilization: data.block_utilization ?? prev.utilization,
            bundles: data.cross_department_bundles ?? prev.bundles
          }))
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
  }, [])

  return (
    <div className="space-y-6">
      {/* Header & Source Badge */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Dashboard Overview</h2>
          <p className="text-sm text-gray-500">Real-time KPI metrics and maintenance operational analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${isLive ? 'badge-success' : 'badge-info'}`}>
            {isLive ? 'Live API Data' : 'Local Fallback'}
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
          <h3 className="text-base font-semibold text-gray-900 mb-4">Daily Job Trends</h3>
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
              <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Completed" />
              <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} name="Pending" />
              <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Critical" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Jobs by Department */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Jobs by Department</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={jobsByDepartment}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="department"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} name="Jobs" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Conflicts */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Active Conflicts</h3>
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
              {conflicts.map((c) => (
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
      </div>
    </div>
  )
}
