import { FileBarChart } from 'lucide-react'

export default function Reports() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="p-4 bg-emerald-50 rounded-2xl mb-4">
        <FileBarChart className="w-12 h-12 text-emerald-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Reports</h2>
      <p className="text-gray-500 max-w-md mb-4">
        Comprehensive reporting with exportable PDFs, maintenance KPI trends, utilization analytics, and compliance dashboards.
      </p>
      <span className="badge-info badge">Coming in Phase 2</span>
    </div>
  )
}
